#!/usr/bin/env bash
# =============================================================
# PHMP — إعداد/التحقق من النفق الدائم عبر Workers VPC (بدون نطاق)
#
# البنية:
#   Worker (workers.dev) → VPC service (phmp-app) → Tunnel (phmp-api) → 127.0.0.1:3001
#
# لا يحتاج هذا السكربت إلى Zone/نطاق. لا يطبع أي سرّ.
# الاستعمال:
#   bash setup-tunnel.sh            # تحقق + إرشاد
#   CLOUDFLARE_API_TOKEN=... bash setup-tunnel.sh --check-api
# =============================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_DIR/server/.env"
TUNNEL_NAME="${PHMP_TUNNEL_NAME:-phmp-api}"
WORKER_URL="${PHMP_WORKER_URL:-https://phmp-api.balbolghol-ai.workers.dev}"
VPC_SERVICE_NAME="${PHMP_VPC_SERVICE:-phmp-app}"
ORIGIN="${PHMP_ORIGIN:-http://127.0.0.1:3001}"

say() { printf '\n%s\n' "$*"; }
ok()  { printf '✅ %s\n' "$*"; }
warn(){ printf '⚠️  %s\n' "$*"; }
die() { printf '❌ %s\n' "$*" >&2; exit 1; }

# ---------- 1) cloudflared ----------
say "1) فحص cloudflared"
if [[ -x /usr/local/bin/cloudflared ]]; then
  CF=/usr/local/bin/cloudflared
elif command -v cloudflared >/dev/null 2>&1; then
  CF="$(command -v cloudflared)"
else
  die "cloudflared غير مثبت. ثبّت الحزمة الرسمية (وليس نسخة npm القديمة)."
fi
"$CF" --version
ok "الثنائي: $CF"

# ---------- 2) التوكن في .env ----------
say "2) فحص توكن النفق في server/.env"
[[ -f "$ENV_FILE" ]] || die "server/.env غير موجود. انسخ server/.env.example واملأه."
chmod 600 "$ENV_FILE" 2>/dev/null || true
TOKEN="$(grep -E '^CLOUDFLARE_TUNNEL_TOKEN=' "$ENV_FILE" | head -1 | sed 's/^[^=]*=//; s/"$//')"
[[ -n "${TOKEN:-}" ]] || die "CLOUDFLARE_TUNNEL_TOKEN غير موجود في server/.env"
ok "التوكن موجود (لن يُطبع)"

# استخراج معرف النفق من التوكن (base64 JSON) دون طباعة التوكن
TUNNEL_ID="$(printf '%s' "$TOKEN" | base64 -d 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin).get("t",""))' 2>/dev/null || true)"
[[ -n "$TUNNEL_ID" ]] && ok "Tunnel ID: $TUNNEL_ID" || warn "تعذّر استخراج Tunnel ID من التوكن"

# ---------- 3) فحص API (اختياري) ----------
say "3) فحص حالة النفق عبر Cloudflare API (اختياري)"
if [[ "${1:-}" == "--check-api" ]]; then
  : "${CLOUDFLARE_API_TOKEN:?ضع CLOUDFLARE_API_TOKEN في البيئة}"
  : "${CLOUDFLARE_ACCOUNT_ID:?ضع CLOUDFLARE_ACCOUNT_ID في البيئة}"
  [[ -n "$TUNNEL_ID" ]] || die "لا يمكن الفحص بدون Tunnel ID"
  curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID" \
    | python3 -c 'import sys,json; r=json.load(sys.stdin).get("result") or {}; print(f"status={r.get(\"status\")} conns={len(r.get(\"connections\") or [])}")'
else
  echo "   تخطّي: مرّر --check-api مع CLOUDFLARE_API_TOKEN لتفعيله."
fi

# ---------- 4) فحص Worker ----------
say "4) فحص Worker العام"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$WORKER_URL/_gateway/health" || true)"
[[ "$CODE" == "200" ]] && ok "Worker يعمل: $WORKER_URL" || warn "Worker أعاد $CODE — تحقق من النشر"

# ---------- 5) خطوات VPC (مرة واحدة) ----------
say "5) إعداد Workers VPC (لوحة Cloudflare — مرة واحدة)"
cat <<EOF
   1. Zero Trust → Networks → Tunnels: تأكد من وجود النفق "$TUNNEL_NAME" وحالته Healthy.
   2. Workers VPC → Create service:
        الاسم: $VPC_SERVICE_NAME
        النفق: $TUNNEL_NAME
        الوجهة المحلية: $ORIGIN
   3. انسخ service_id وضعه في infra/cloudflare/phmp-api/wrangler.toml:
        [[vpc_services]]
        binding = "PHMP"
        service_id = "<service_id>"
        remote = true
   4. انشر Worker:
        cd "$REPO_DIR/infra/cloudflare/phmp-api" && npx wrangler deploy
   5. شغّل النفق محلياً (الحارس يشغّله تلقائياً):
        bash "$REPO_DIR/server/tunnel/start-tunnel.sh"
EOF

say "التحقق النهائي"
echo "  curl -s $WORKER_URL/api/health"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:20244/ready"
