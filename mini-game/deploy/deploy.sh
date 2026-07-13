#!/usr/bin/env bash
# Build + (re)start MLN122 trên droplet. Dùng cho cả lần đầu lẫn cập nhật.
#   chmod +x deploy/deploy.sh   &&   ./deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."   # -> mini-game/

echo "==> Kéo code mới nhất"
git pull --ff-only || echo "(bỏ qua git pull)"

echo "==> Build client (client/dist)"
( cd client && npm ci && npm run build )

echo "==> Build server (server/dist)"
( cd server && npm ci && npm run build )

if [ ! -f server/.env ]; then
  echo "!! Thiếu server/.env — copy từ deploy/env.production.example rồi điền secret + domain."
  exit 1
fi

echo "==> (Re)start PM2"
pm2 restart mln122 --update-env 2>/dev/null || pm2 start deploy/ecosystem.config.js
pm2 save

echo "==> Health check"
sleep 1
curl -fsS localhost:3000/healthz && echo "  <- OK" || echo "  !! healthz FAIL — xem: pm2 logs mln122"
