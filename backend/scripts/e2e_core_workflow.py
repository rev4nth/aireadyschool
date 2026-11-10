"""Smoke-test the PS core loop against a running local API."""

from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

BASE = "http://127.0.0.1:8000/api/v1"
SUPABASE = os.environ["SUPABASE_URL"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANON = os.environ["SUPABASE_ANON_KEY"]


NOTES = """
Syllabus
Unit 1: Cell Structure
- Cell membrane
- Nucleus
- Mitochondria
Unit 2: Photosynthesis
- Light reaction
- Dark reaction / Calvin cycle
- Chlorophyll and chloroplasts
Unit 3: Respiration
- Glycolysis
- Krebs cycle

Past papers frequently ask about Photosynthesis light reaction and Calvin cycle.

Textbook notes:
Photosynthesis converts light energy into chemical energy. The light reaction occurs
in thylakoid membranes and produces ATP and NADPH. The Calvin cycle fixes carbon
dioxide into glucose in the stroma. Chlorophyll absorbs light energy. Mitochondria
are the powerhouse of the cell and produce ATP through cellular respiration.
Glycolysis breaks down glucose in the cytoplasm.
""".strip()


def main() -> None:
    email = f"e2e_{uuid.uuid4().hex[:8]}@mailinator.com"
    password = "E2ETestPass123!"
    admin = {
        "apikey": SERVICE,
        "Authorization": f"Bearer {SERVICE}",
        "Content-Type": "application/json",
    }
    anon_h = {
        "apikey": ANON,
        "Authorization": f"Bearer {ANON}",
        "Content-Type": "application/json",
    }

    r = httpx.post(
        f"{SUPABASE}/auth/v1/admin/users",
        headers=admin,
        json={"email": email, "password": password, "email_confirm": True},
        timeout=30,
    )
    print("auth_user", r.status_code)
    tok = httpx.post(
        f"{SUPABASE}/auth/v1/token?grant_type=password",
        headers=anon_h,
        json={"email": email, "password": password},
        timeout=30,
    ).json()["access_token"]
    H = {"Authorization": f"Bearer {tok}"}

    s = httpx.post(
        f"{BASE}/subjects",
        headers=H,
        json={"name": "Biology", "description": "Cells and photosynthesis"},
        timeout=40,
    )
    print("subject", s.status_code)
    sid = s.json()["id"]

    t = httpx.post(
        f"{BASE}/materials/text",
        headers=H,
        json={
            "title": "Biology Syllabus and Notes",
            "subject_id": sid,
            "doc_type": "syllabus",
            "content": NOTES,
        },
        timeout=60,
    )
    print("upload", t.status_code, t.text[:180])
    mid = t.json()["id"]

    status = {}
    for i in range(30):
        st = httpx.get(f"{BASE}/materials/{mid}/status", headers=H, timeout=30)
        status = st.json()
        print("process", i, status.get("status"), status.get("chunk_count"), status.get("error_message"))
        if status.get("status") in {"processed", "failed"}:
            break
        time.sleep(3)
    assert status.get("status") == "processed", status

    topics = httpx.post(
        f"{BASE}/topics/generate",
        headers=H,
        json={"subject_id": sid},
        timeout=120,
    )
    print("topics", topics.status_code, topics.text[:300])
    assert topics.status_code == 200, topics.text

    quiz = httpx.post(
        f"{BASE}/quizzes/generate",
        headers=H,
        json={
            "subject_id": sid,
            "quiz_mode": "subject",
            "difficulty": "mixed",
            "question_count": 3,
            "question_types": ["mcq", "short_answer"],
        },
        timeout=180,
    )
    print("quiz", quiz.status_code, quiz.text[:350])
    assert quiz.status_code == 200, quiz.text
    qid = quiz.json()["id"]

    started = httpx.post(f"{BASE}/quizzes/{qid}/start", headers=H, timeout=40)
    print("start", started.status_code)
    attempt_id = started.json()["attempt_id"]
    questions = started.json()["quiz"]["questions"]

    answers = []
    for q in questions:
        if q.get("options"):
            answers.append({"question_id": q["id"], "answer_text": str(q["options"][0])})
        else:
            answers.append({"question_id": q["id"], "answer_text": "ATP and NADPH from light reaction"})

    submitted = httpx.post(
        f"{BASE}/quizzes/{qid}/submit",
        headers=H,
        json={"attempt_id": attempt_id, "answers": answers},
        timeout=180,
    )
    print("submit", submitted.status_code, submitted.text[:350])
    assert submitted.status_code == 200, submitted.text

    gap = httpx.post(
        f"{BASE}/gap-reports/generate",
        headers=H,
        json={"subject_id": sid, "attempt_id": attempt_id},
        timeout=120,
    )
    print("gap", gap.status_code, gap.text[:350])
    assert gap.status_code == 200, gap.text

    plan = httpx.post(
        f"{BASE}/revision-plans",
        headers=H,
        json={
            "subject_id": sid,
            "gap_report_id": gap.json()["id"],
            "available_days": 5,
            "hours_per_day": 2,
        },
        timeout=120,
    )
    print("plan", plan.status_code, plan.text[:350])
    assert plan.status_code in {200, 201}, plan.text

    chat = httpx.post(
        f"{BASE}/assistant/chat",
        headers=H,
        json={
            "subject_id": sid,
            "message": "Explain the light reaction of photosynthesis simply.",
            "mode": "explain",
        },
        timeout=120,
    )
    print("chat", chat.status_code, chat.text[:350])
    assert chat.status_code == 200, chat.text

    analytics = httpx.get(f"{BASE}/analytics", headers=H, params={"subject_id": sid}, timeout=40)
    print("analytics", analytics.status_code)
    assert analytics.status_code == 200, analytics.text

    print("E2E_CORE_WORKFLOW_OK")
    print(json.dumps({"email": email, "subject_id": sid, "quiz_id": qid}, indent=2))


if __name__ == "__main__":
    main()
