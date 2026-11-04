// =====================================================================
// PHMP — ثوابت مشتركة بين موجّه الـWorker وDurable Object
// ---------------------------------------------------------------------
// نفس قيم خادم الهاتف (server/src/realtime.js + index.js) حرفياً كي يكون
// سلوك الطبقة السحابية مطابقاً تماماً للبروتوكول الذي تعرفه الواجهات.
// =====================================================================

// حدود الرسائل والمكالمات (مطابقة للخادم المحلي)
export const MAX_PAYLOAD = 32 * 1024        // 32 كيلوبايت كحد أقصى لرسالة WS
export const MAX_TEXT = 2000                // طول نص الدردشة
export const RATE_LIMIT = 30                // رسالة كحد أقصى…
export const RATE_WINDOW = 10 * 1000        // …كل 10 ثوانٍ لكل اتصال
export const CALL_RATE_LIMIT = 30           // إشارة مكالمة كحد أقصى…
export const CALL_RATE_WINDOW = 60 * 1000   // …كل دقيقة لكل اتصال
export const HEARTBEAT_MS = 30 * 1000       // نبض دوري للمقابس الحية

// حدود الطلبات (مطابقة لخادم الهاتف)
export const ORDER_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'dispatched', 'completed', 'cancelled']
export const ORDER_JSON_MAX = 2 * 1024 * 1024
export const ORDER_ITEMS_MAX = 50
export const ORDER_RATE_WINDOW = 60 * 60 * 1000
export const ORDER_RATE_MAX = 40
export const ORDERS_KEEP_DAYS = 120         // الاحتفاظ بالطلبات 120 يوماً في الـDO
export const ORDERS_MAX = 5000              // سقف أقصى عملي (تُحذف الأقدم تجاوزاً)
export const SYNC_PAGE_MAX = 500            // صفحة سحب المرآة

// أدوار الموظفين الصالحة (نظام الصلاحيات)
export const STAFF_ROLES = ['super_admin', 'admin', 'accountant', 'pharmacist', 'cashier']

// الأصول المسموح بها (نفس server/src/origins.js + phmp-assistant)
export const CAPACITOR_ORIGINS = [
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'ionic://localhost',
]

export function makeOriginAllowed(allowedOriginsCsv) {
  const list = String(allowedOriginsCsv ||
    'https://phmp.pages.dev,https://phmplatform.vercel.app,https://pharmacare-pro-jade.vercel.app,https://phmp-download.pages.dev')
    .split(',').map((s) => s.trim()).filter(Boolean)
  return (origin) => {
    if (!origin) return true // عملاء غير متصفح (اختبارات Node / تطبيق أندرويد)
    if (list.includes(origin) || CAPACITOR_ORIGINS.includes(origin)) return true
    try {
      const host = new URL(origin).hostname
      if (host === 'phmp.pages.dev' || host.endsWith('.phmp.pages.dev')) return true
      if (host.endsWith('.vercel.app')) {
        return host.startsWith('phmplatform-') || host.startsWith('pharmacare-pro-jade-')
      }
      return false
    } catch {
      return false
    }
  }
}

// تطبيع رقم الهاتف (مطابقة هاتف صاحب الطلب مع هوية الزبون المتصل)
export const normalizePhone = (raw) => (typeof raw === 'string' ? raw.replace(/[\s-]/g, '') : '')

export const strField = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// ===== JWT HS256 عبر Web Crypto (متوافق مع jsonwebtoken على الخادم) =====
const b64urlToBytes = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export async function verifyJwtHS256(token, secret) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return null
  try {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify('HMAC', key, b64urlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])))
    if (!payload || typeof payload !== 'object') return null
    if (payload.exp && payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const jsonResponse = (obj, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  })
