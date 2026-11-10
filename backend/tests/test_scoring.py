from app.services.gap_analysis.scoring import AttemptSignal, classify_mastery, compute_mastery
from app.services.revision.planner import compute_priority


def test_classify_mastery_thresholds():
    assert classify_mastery(20) == "weak"
    assert classify_mastery(60) == "medium"
    assert classify_mastery(90) == "strong"


def test_compute_mastery_weights_recent_and_difficulty():
    signals = [
        AttemptSignal(score=40, difficulty="easy"),
        AttemptSignal(score=80, difficulty="hard"),
    ]
    result = compute_mastery(signals)
    assert 0 <= result.mastery_score <= 100
    assert result.classification in {"weak", "medium", "strong"}
    assert result.recent_score is not None


def test_compute_mastery_empty():
    result = compute_mastery([])
    assert result.mastery_score == 0.0
    assert result.classification == "not_assessed"


def test_revision_priority_formula():
    # Priority = weakness_severity + exam_importance + past_paper_frequency
    priority = compute_priority(
        weakness_severity=65,
        exam_importance=80,
        past_paper_frequency=30,
    )
    assert priority == 175.0
