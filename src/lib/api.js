// طبقة الاتصال بالخادم المحلي (SQLite + نفق دائم)
// تعمل المنصة في وضعين:
// 1. وضع محلي مستقل (localStorage) - افتراضي
// 2. وضع متصل بالخادم المحلي (SQLite عبر النفق) - عند توفر الخادم
//
// ملاحظة أمنية: مفتاح API يُضمَّن في حزمة الواجهة عند البناء (VITE_PHMP_API_KEY)
// أو يُدخَل يدوياً في الإعدادات ويُحفظ في localStorage. لأنه يصل إلى المتصفح
// فهو حاجز ضد الفاحصين العشوائيين لا سرّ حقيقي؛ الحماية الفعلية للبيانات
// الحساسة تبقى عبر JWT بعد ربط الدخول بالخادم.

const API_URL_KEY = 'pharmacare_api_url'
const API_KEY_STORAGE = 'pharmacare_api_key'

// النفق الدائم (Workers VPC → Cloudflare Tunnel → 127.0.0.1:3001)
export const DEFAULT_API_URL = 'https://phmp-api.balbolghol-ai.workers.dev'

export const getApiUrl = () => {
  try {
    return localStorage.getItem(API_URL_KEY)?.replace(/"/g, '') || DEFAULT_API_URL
  } catch {
    return DEFAULT_API_URL
  }
}

export const setApiUrl = (url) => {
  try {
    localStorage.setItem(API_URL_KEY, JSON.stringify(url))
  } catch { /* ignore */ }
}

export const getApiKey = () => {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || import.meta.env.VITE_PHMP_API_KEY || ''
  } catch {
    return import.meta.env.VITE_PHMP_API_KEY || ''
  }
}

export const setApiKey = (key) => {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key)
    else localStorage.removeItem(API_KEY_STORAGE)
  } catch { /* ignore */ }
}

const request = async (path, options = {}) => {
  const url = `${getApiUrl()}${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeout || 5000)
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const key = getApiKey()
  if (key) headers['x-phmp-key'] = key
  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return res
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

export const api = {
  // فحص جاهزية الخادم
  async checkHealth() {
    try {
      const res = await request('/api/health', { timeout: 3000 })
      return res.ok
    } catch {
      return false
    }
  },

  // تسجيل الدخول عبر الخادم (كلمات مرور مشفرة bcrypt + JWT)
  async login(username, password) {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) throw new Error('فشل الاتصال بالخادم')
    const data = await res.json()
    if (data.token) localStorage.setItem('pharmacare_jwt', JSON.stringify(data.token))
    return data
  },

  // مزامنة كاملة للبيانات مع قاعدة SQLite
  async sync(payload) {
    try {
      const res = await request('/api/sync', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeout: 15000,
      })
      return res.ok
    } catch {
      return false
    }
  },

  // استرجاع البيانات من الخادم
  async fetchAll() {
    try {
      const res = await request('/api/data', { timeout: 10000 })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  },

  // إنشاء نسخة احتياطية من قاعدة SQLite
  async backup() {
    try {
      const res = await request('/api/backup', { timeout: 20000 })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  },
}
