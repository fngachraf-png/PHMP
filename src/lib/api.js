// طبقة الاتصال بالخادم المحلي (SQLite + نفق دائم)
// تعمل المنصة في وضعين:
// 1. وضع محلي مستقل (localStorage) - افتراضي
// 2. وضع متصل بالخادم المحلي (SQLite عبر النفق) - عند توفر الخادم

// عنوان الخادم المحلي - يُحدَّث تلقائياً من ملف الإعدادات أو يدوياً من صفحة الإعدادات
const API_URL_KEY = 'pharmacare_api_url'
// الافتراضي: نفق cloudflared المحلي للخادم (يُستبدل بعنوان النفق الدائم عند التنصيب)
export const DEFAULT_API_URL = 'https://phmp-api.trycloudflare.com'

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

const request = async (path, options = {}) => {
  const url = `${getApiUrl()}${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeout || 5000)
  try {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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
