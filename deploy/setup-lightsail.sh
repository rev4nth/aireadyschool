#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/aiready}"
REPO_URL="${REPO_URL:-https://github.com/rev4nth/aireadyschool.git}"
PUBLIC_URL="${PUBLIC_URL:-http://3.27.167.3}"

echo "==> Installing Docker if needed"
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl git
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker ubuntu || true
fi

echo "==> Cloning / updating repo at ${APP_DIR}"
sudo mkdir -p "${APP_DIR}"
sudo chown -R ubuntu:ubuntu "${APP_DIR}"
if [ -d "${APP_DIR}/.git" ]; then
  git -C "${APP_DIR}" fetch --all
  git -C "${APP_DIR}" reset --hard origin/main
else
  git clone "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

if [ ! -f backend/.env ]; then
  echo "ERROR: backend/.env missing. Upload it before running compose."
  exit 1
fi

# Ensure production URLs point at this Lightsail box
python3 - <<'PY' || true
from pathlib import Path
p = Path("backend/.env")
text = p.read_text()
replacements = {
    "FRONTEND_URL=": f"FRONTEND_URL={Path('/tmp/public_url').read_text().strip() if Path('/tmp/public_url').exists() else 'http://3.27.167.3'}",
}
# Keep existing keys; only force FRONTEND/BACKEND if present
lines = []
for line in text.splitlines():
    if line.startswith("FRONTEND_URL="):
        lines.append(f"FRONTEND_URL=http://3.27.167.3")
    elif line.startswith("BACKEND_URL="):
        lines.append(f"BACKEND_URL=http://3.27.167.3")
    elif line.startswith("APP_ENV="):
        lines.append("APP_ENV=production")
    else:
        lines.append(line)
p.write_text("\n".join(lines) + "\n")
print("Updated backend/.env host URLs")
PY

# Load frontend public build args from frontend/.env if present
set -a
[ -f frontend/.env ] && . frontend/.env
set +a

export FRONTEND_URL="${PUBLIC_URL}"
export BACKEND_URL="${PUBLIC_URL}"
export VITE_API_BASE_URL="${PUBLIC_URL}/api/v1"
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}"
export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}"

echo "==> Building and starting stack (this can take several minutes on 1GB RAM)"
cd deploy
sudo docker compose -f docker-compose.prod.yml down --remove-orphans || true
sudo docker compose -f docker-compose.prod.yml up -d --build

echo "==> Waiting for health"
sleep 8
curl -fsS "${PUBLIC_URL}/health" || curl -fsS http://127.0.0.1/health || true
echo
echo "Deployed. Open ${PUBLIC_URL}"
sudo docker compose -f docker-compose.prod.yml ps
