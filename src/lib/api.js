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
// عدّاد إقلاعات فشل فيها الرابط المخصص (للشفاء التلقائي بعد 3 متتالية)
const API_URL_FAILS_KEY = 'pharmacare_api_url_fails'

// النفق الدائم (Workers VPC → Cloudflare Tunnel → 127.0.0.1:3001)
export const DEFAULT_API_URL = 'https://phmp-api.balbolghol-ai.workers.dev'

// الطبقة السحابية الدائمة للاتصال الفوري والطلبات (Durable Object يعمل
// على حافة Cloudflare على مدار الساعة) — لا تتأثر بجاهزية خادم الهاتف.
// الواجهات الثلاث (كلاودفلير/ڤيرسيل/أندرويد) تلتقي هنا فتتشاطر الطلبات
// والدردشة والمكالمات آنياً مهلا كان خادم المالك متصلاً أم لا.
export const LIVE_API_URL = 'https://phmp-realtime.balbolghol-ai.workers.dev'
const LIVE_URL_KEY = 'pharmacare_live_url'
const LIVE_RETRY_AFTER = 2 * 60 * 1000 // إن غابت الطبقة: إعادة المحاولة بعد دقيقتين
let liveDownUntil = 0

export const getLiveUrl = () => {
  try {
    return localStorage.getItem(LIVE_URL_KEY)?.replace(/"/g, '') || LIVE_API_URL
  } catch {
    return LIVE_API_URL
  }
}

export const setLiveUrl = (url) => {
  try {
    if (url) localStorage.setItem(LIVE_URL_KEY, JSON.stringify(url))
    else localStorage.removeItem(LIVE_URL_KEY)
  } catch { /* ignore */ }
}

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

// ===== رمز JWT (جلسة الموظف بعد الدخول عبر الخادم) =====
const JWT_KEY = 'pharmacare_jwt'

export const getAuthToken = () => {
  try {
    return localStorage.getItem(JWT_KEY)?.replace(/"/g, '') || ''
  } catch {
    return ''
  }
}

export const setAuthToken = (token) => {
  try {
    if (token) localStorage.setItem(JWT_KEY, JSON.stringify(token))
    else localStorage.removeItem(JWT_KEY)
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

// ترويسات المصادقة (JWT) — تُمرَّر كما هي للطبقة السحابية والبوابة معاً
const authHeaders = () => {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// طلب مصادق بجلسة الموظف (Authorization: Bearer JWT)
const authRequest = (path, options = {}) => {
  const token = getAuthToken()
  return request(path, {
    ...options,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  })
}

// ===== طلب موجه للطبقة السحابية الدائمة مع احتياط البوابة =====
// أخطاء الشبكة فقط (تعذر الوصول للطبقة السحابية) تُسقط للمسار القديم —
// أما ردود HTTP الحقيقية (4xx/2xx) فتُمرّر كما هي: إنها نتيجة الخادم نفسه.
async function liveRequest(path, options = {}) {
  if (Date.now() < liveDownUntil) {
    const err = new Error('live_unreachable')
    err.networkError = true
    throw err
  }
  const url = `${getLiveUrl()}${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeout || 8000)
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
    liveDownUntil = Date.now() + LIVE_RETRY_AFTER
    const wrapped = new Error('live_unreachable')
    wrapped.networkError = true
    wrapped.cause = err
    throw wrapped
  }
}

// طلب طبقة سحابية مع سقوط تلقائي للبوابة (خادم المالك) عند تعذر الوصول
async function liveOrGateway(path, options = {}) {
  try {
    return await liveRequest(path, options)
  } catch (err) {
    if (!err?.networkError) throw err
    return request(path, options)
  }
}

// طلب مصادق (موظف): يضاف سقوط للبوابة عند «تعذر التحقق» من الطبقة السحابية
// (503 verify_unavailable — السر غير مضبوط والهاتف نائم/قديم) — أما 401
// الحقيقي فيُمرّر كما هو (الرمز فاسد فعلاً والبوابة ستقول الشيء نفسه).
async function liveAuthOrGateway(path, options = {}) {
  let res
  try {
    res = await liveRequest(path, options)
  } catch (err) {
    if (!err?.networkError) throw err
    return request(path, options)
  }
  if (res.status === 503) {
    const body = await res.clone().json().catch(() => ({}))
    if (body?.error === 'verify_unavailable') return request(path, options)
  }
  return res
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

  // ===== الشفاء التلقائي لرابط الخادم (إصلاح v2.2.0) =====
  // رابط مخصص محفوظ محلياً (من إعدادات قديمة أو تجربة) قد يعلق المنصة في
  // «وضع محلي» للأبد إن مات خادمه. عند الإقلاع: إن فشل الرابط المخصص
  // 3 إقلاعات متتالية بينما الرابط الافتراضي (نفق المالك) يستجيب ← يُعاد
  // للرابط الافتراضي تلقائياً وتُعاد الدالة { reset:true, from } كي تعرض
  // الواجهة إشعاراً مترجماً. فشل الشبكة كلياً لا يُحتسب (لا حكم على الرابط).
  async healApiUrl() {
    const current = getApiUrl()
    if (current === DEFAULT_API_URL) {
      try { localStorage.removeItem(API_URL_FAILS_KEY) } catch { /* تجاهل */ }
      return null
    }
    const customOk = await this.checkHealth()
    if (customOk) {
      try { localStorage.removeItem(API_URL_FAILS_KEY) } catch { /* تجاهل */ }
      return null
    }
    // الرابط المخصص لا يستجيب: نتحقق أن الافتراضي سليم قبل أي حكم
    let defaultOk = false
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${DEFAULT_API_URL}/api/health`, { signal: controller.signal })
      clearTimeout(timer)
      defaultOk = res.ok
    } catch { defaultOk = false }
    if (!defaultOk) return null // الشبكة/الخادمان معطلان — لا يُلمس الرابط
    let fails = 1
    try {
      fails = (parseInt(localStorage.getItem(API_URL_FAILS_KEY), 10) || 0) + 1
      localStorage.setItem(API_URL_FAILS_KEY, String(fails))
    } catch { /* التخزين معطل — نكتفي بالعدّ في الذاكرة لهذا الإقلاع */ }
    if (fails < 3) return null
    try { localStorage.removeItem(API_URL_FAILS_KEY) } catch { /* تجاهل */ }
    setApiUrl(DEFAULT_API_URL)
    return { reset: true, from: current, to: DEFAULT_API_URL }
  },

  // تسجيل الدخول عبر الخادم (كلمات مرور مشفرة bcrypt + JWT)
  async login(username, password) {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      timeout: 8000,
    })
    // الخادم ردّ: أخطاء الدخول (401/403/429) تُمرَّر برسالتها الأصلية
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(data.error || 'فشل الاتصال بالخادم')
      err.status = res.status
      err.serverResponded = true
      throw err
    }
    if (data.token) setAuthToken(data.token)
    return data
  },

  // خروج: مسح رمز الجلسة محلياً
  logout() {
    setAuthToken('')
  },

  // ===== إدارة المستخدمين عبر الخادم (JWT) =====
  async fetchUsers() {
    const res = await authRequest('/api/users', { timeout: 8000 })
    if (!res.ok) return null
    const rows = await res.json()
    // تحويل أعمدة SQLite (snake_case) إلى شكل الواجهة (camelCase)
    return rows.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      nameEn: u.nameEn || '',
      role: u.role,
      pharmacyId: u.pharmacy_id ?? null,
      avatar: u.avatar || '👤',
      active: u.active === 1 || u.active === true,
      lastLogin: u.last_login || null,
    }))
  },

  async createUser(payload) {
    const res = await authRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeout: 8000,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء المستخدم على الخادم')
    return data
  },

  async updateUserRemote(id, updates) {
    const res = await authRequest(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      timeout: 8000,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'فشل تحديث المستخدم على الخادم')
    return data
  },

  async deleteUserRemote(id) {
    const res = await authRequest(`/api/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      timeout: 8000,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'فشل حذف المستخدم على الخادم')
    return data
  },

  // ===== نقل ملكية المنصة (سوبر أدمين فقط — تأكيد بكلمة المرور الحالية) =====
  async transferOwnership({ targetUserId, currentPassword, selfNewRole, selfPharmacyId }) {
    const res = await authRequest('/api/platform/transfer-ownership', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, currentPassword, selfNewRole, selfPharmacyId }),
      timeout: 12000,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'فشل نقل ملكية المنصة')
    return data
  },

  // ===== الصيدليات =====
  async fetchPharmacies() {
    const res = await request('/api/pharmacies', { timeout: 8000 })
    if (!res.ok) return null
    const rows = await res.json()
    return rows.map(p => ({
      id: p.id, name: p.name, nameEn: p.nameEn || p.name, address: p.address || '',
      phone: p.phone || '', email: p.email || '', license: p.license || '',
      logo: p.logo || '💊', color: p.color || 'blue',
    }))
  },

  async createPharmacy(payload) {
    const res = await authRequest('/api/pharmacies', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeout: 8000,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء الصيدلية على الخادم')
    return data
  },

  // ===== الطلبات المباشرة (مزامنة عبر الواجهات: Pages/Vercel/أندرويد) =====
  // المصدر الموحّد: الطبقة السحابية الدائمة (Durable Object على حساب المالك)
  // — تُخزَّن الطلبات هناك وتبث فورياً للجميع، ويحافظ خادم المالك على نسخة
  // SQLite تاريخية عبر مرآة اتجاهين (تكليف المالك v2.3.0 بعد قياس نقطة
  // الفشل الوحيدة في v2.1/v2.2: انقطاع خادم الهاتف كان يوقف كل شيء).
  async createOrder(order) {
    const res = await liveOrGateway('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order),
      timeout: 10000,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(data.error || 'فشل حفظ الطلب على الخادم'), { status: res.status })
    return data
  },

  // جلب الطلبات (موظفون — JWT): نفس القائمة على كل الواجهات
  async fetchOrders({ since, limit, pharmacyId } = {}) {
    const qs = new URLSearchParams()
    if (since) qs.set('since', since)
    if (limit) qs.set('limit', String(limit))
    if (pharmacyId) qs.set('pharmacyId', pharmacyId)
    const res = await liveAuthOrGateway(`/api/orders${qs.toString() ? '?' + qs.toString() : ''}`, { timeout: 10000, headers: authHeaders() })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(data.error || 'فشل جلب الطلبات'), { status: res.status })
    return Array.isArray(data) ? data : []
  },

  // تحديث حالة الطلب (يبثها فورياً لكل الأجهزة)
  async updateOrderRemote(id, updates) {
    const res = await liveAuthOrGateway(`/api/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(updates), timeout: 10000, headers: authHeaders() })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(data.error || 'فشل تحديث الطلب'), { status: res.status })
    return data
  },

  // إلغاء طلب من طرف الزبون (يتحقق الخادم من هاتف صاحب الطلب)
  async cancelOrderRemote(id, phone) {
    const path = `/api/orders/${encodeURIComponent(id)}/cancel`
    let res
    try {
      res = await liveRequest(path, { method: 'POST', body: JSON.stringify({ phone }), timeout: 10000 })
    } catch (err) {
      if (!err?.networkError) throw err
      res = await request(path, { method: 'POST', body: JSON.stringify({ phone }), timeout: 10000 })
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(data.error || 'فشل إلغاء الطلب'), { status: res.status })
    return data
  },

  // تتبع طلبات الزبون بالهاتف (حقول دنيا — عبر الأجهزة)
  async trackOrders(phone) {
    if (!phone) return []
    const qs = new URLSearchParams({ phone: String(phone) })
    const path = `/api/orders/track?${qs.toString()}`
    let res
    try {
      res = await liveRequest(path, { timeout: 8000 })
    } catch (err) {
      if (!err?.networkError) throw err
      res = await request(path, { timeout: 8000 })
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(data.error || 'فشل تتبع الطلبات'), { status: res.status })
    return Array.isArray(data) ? data : []
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
