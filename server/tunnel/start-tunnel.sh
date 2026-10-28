#!/usr/bin/env bash
# PHMP — تشغيل النفق الدائم (Cloudflare Tunnel) للخادم المحلي
# المتطلب: CLOUDFLARE_TUNNEL_TOKEN في server/.env (600) — لا يُرفع أبداً.
# البروتوكول http2 مُثبت على شبكة الهاتف (QUIC متذبذب/محجوب أحياناً).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

TOKEN="$(grep -E '^CLOUDFLARE_TUNNEL_TOKEN=' server/.env | head -1 | sed 's/^CLOUDFLARE_TUNNEL_TOKEN=//; s/"$//')"
if [[ -z "${TOKEN:-}" ]]; then
  echo "❌ CLOUDFLARE_TUNNEL_TOKEN غير موجود في server/.env"
  exit 1
fi

command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock || true

# ثنائي النظام أولاً: نسخة npm القديمة (2026.10.1) تجمّدت بعد تهيئة ICMP بلا اتصالات.
if [[ -x /usr/local/bin/cloudflared ]]; then
  CLOUDFLARED=/usr/local/bin/cloudflared
else
  CLOUDFLARED="$(command -v cloudflared)"
fi
if [[ -z "${CLOUDFLARED:-}" ]]; then
  echo "❌ cloudflared غير مثبت"
  exit 1
fi

# منفذ metrics ثابت كي يتحقق الحارس من /ready (cloudflared يختار منفذاً عشوائياً بدونه).
exec "$CLOUDFLARED" --protocol http2 --no-autoupdate \
  --metrics 127.0.0.1:20244 tunnel run --token "$TOKEN"
