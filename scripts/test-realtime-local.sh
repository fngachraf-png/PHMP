#!/usr/bin/env bash
# اختبار phmp-realtime محلياً عبر wrangler dev (miniflare) — بلا حساب Cloudflare
# الاستعمال: bash scripts/test-realtime-local.sh
set -u
cd "$(dirname "$0")/.."

WRANGLER_DIR="${WRANGLER_DIR:-/tmp/wrangler-test}"
WRANGLER="$WRANGLER_DIR/node_modules/.bin/wrangler"
PORT="${PHMP_TEST_PORT:-8799}"

if [ ! -x "$WRANGLER" ]; then
  echo "⚙️  تثبيت wrangler محلياً في $WRANGLER_DIR ..."
  mkdir -p "$WRANGLER_DIR"
  (cd "$WRANGLER_DIR" && npm install wrangler@3 --no-fund --no-audit --loglevel=error)
fi

echo "🚀 تشغيل wrangler dev على 127.0.0.1:$PORT (بلا اتصال بحساب) ..."
# ملاحظة: JWT_SECRET للاختبار يُقرأ من infra/cloudflare/phmp-realtime/.dev.vars
"$WRANGLER" dev infra/cloudflare/phmp-realtime/src/index.js \
  --config infra/cloudflare/phmp-realtime/wrangler.toml \
  --local --port "$PORT" --ip 127.0.0.1 > /tmp/phmp-realtime-dev.log 2>&1 &
DEV_PID=$!

cleanup() { kill "$DEV_PID" 2>/dev/null || true; }
trap cleanup EXIT

# انتظار الجاهزية (حتى 45 ثانية)
for i in $(seq 1 45); do
  if curl -sf "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then
    echo "✅ الخادم المحلي جاهز (بعد ${i}s)"
    break
  fi
  sleep 1
  if [ "$i" = "45" ]; then
    echo "❌ لم يجهز الخادم — سجل آخر 30 سطراً:"
    tail -30 /tmp/phmp-realtime-dev.log
    exit 1
  fi
done

# ws للعميل (WS client للاختبار)
if [ ! -d node_modules/ws ]; then
  echo "⚙️  تثبيت ws للاختبار ..."
  npm install --no-save ws --loglevel=error 2>&1 | tail -1
fi

PHMP_TEST_BASE="http://127.0.0.1:$PORT" node scripts/test-phmp-realtime.mjs
TEST_RC=$?

echo ""
echo "——— سجل التشغيل (آخر 15 سطراً) ———"
tail -15 /tmp/phmp-realtime-dev.log
exit $TEST_RC
