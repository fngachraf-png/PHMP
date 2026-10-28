#!/usr/bin/env bash
# =============================================================
# PHMP - إعداد النفق الدائم (Cloudflare Tunnel) - يُنفَّذ مرة واحدة
# المتطلب: نطاق مسجل في حساب Cloudflare (نفس الحساب المستعمل لـ Pages)
# =============================================================
set -e

TUNNEL_NAME="phmp-api"
CONFIG_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$CONFIG_DIR/config.yml"

echo "🔧 إعداد النفق الدائم لخادم PHMP..."

# 1) تثبيت cloudflared إن لم يكن موجوداً
if ! command -v cloudflared &> /dev/null; then
  echo "⏳ تثبيت cloudflared..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install cloudflared
  else
    curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
  fi
fi

# 2) تسجيل الدخول (يفتح المتصفح)
echo "🔑 تسجيل الدخول إلى Cloudflare (سيفتح المتصفح)..."
cloudflared tunnel login

# 3) إنشاء النفق الدائم
echo "🌐 إنشاء النفق: $TUNNEL_NAME..."
cloudflared tunnel create "$TUNNEL_NAME"

# 4) ربط نطاق فرعي بالنفق (عدّل DOMAIN إلى نطاقك)
read -rp "📧 أدخل نطاقك المسجل في Cloudflare (مثال: example.com): " DOMAIN
SUBDOMAIN="phmp-api.$DOMAIN"
echo "🔗 ربط $SUBDOMAIN بالنفق..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$SUBDOMAIN"

# 5) كتابة ملف الإعداد
TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
cat > "$CONFIG_FILE" <<EOF
# PHMP - نفق دائم للخادم المحلي
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $SUBDOMAIN
    service: http://localhost:3001
  - service: http_status:404
EOF

echo ""
echo "✅ اكتمل الإعداد!"
echo "   عنوان الخادم الدائم: https://$SUBDOMAIN"
echo "   شغّل النفق بـ: bash $(dirname "$0")/start-tunnel.sh"
echo ""
echo "📱 في المنصة: الإعدادات ← الخادم المحلي ← أدخل https://$SUBDOMAIN"
