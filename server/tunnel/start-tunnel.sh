#!/usr/bin/env bash
# =============================================================
# PHMP - تشغيل النفق (الدائم إن وُجد، وإلا نفق سريع مؤقت)
# =============================================================
CONFIG_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$CONFIG_DIR/config.yml"

# التأكد من أن الخادم يعمل
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "⚠️  الخادم المحلي لا يعمل. جارٍ تشغيله..."
  cd "$CONFIG_DIR/.."
  (npm start > /dev/null 2>&1 &)
  sleep 3
fi

if [ -f "$CONFIG_FILE" ]; then
  echo "🌐 تشغيل النفق الدائم (named tunnel)..."
  exec cloudflared tunnel run --config "$CONFIG_FILE"
else
  echo "🟠 لا يوجد نفق دائم مُعد (شغّل setup-tunnel.sh أولاً)"
  echo "🌐 تشغيل نفق سريع مؤقت (العنوان يتغير عند كل إعادة تشغيل)..."
  exec cloudflared tunnel --url http://localhost:3001 --no-autoupdate 2>&1 | tee "$CONFIG_DIR/quick-tunnel-url.txt" | grep --line-buffered -o 'https://[-a-z0-9]*\.trycloudflare\.com' | head -1
fi
