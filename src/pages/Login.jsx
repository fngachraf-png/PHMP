import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { api } from '../lib/api'
import { Stethoscope, Lock, User as UserIcon, Eye, EyeOff, ShieldCheck, Pill, Sparkles, Building2, ShoppingBag, Wifi, WifiOff, Loader2 } from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeToggle from '../components/ThemeToggle'

// صفحة دخول الموظفين — المصادقة عبر الخادم المحلي (SQLite + JWT + bcrypt)
// الحسابات التجريبية أُزيلت: الدخول متاح فقط بحسابات رسمية أنشأها مالك المنصة.
const Login = () => {
  const { t, language, login, isRTL, importServerUsers, importServerPharmacies } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [serverCheck, setServerCheck] = useState('checking') // checking | online | offline

  const L = (ar, fr, en) => language === 'ar' ? ar : language === 'fr' ? fr : en

  // فحص اتصال الخادم عند فتح الصفحة (مؤشر واضح قبل محاولة الدخول)
  useEffect(() => {
    let alive = true
    api.checkHealth().then((online) => {
      if (alive) setServerCheck(online ? 'online' : 'offline')
    })
    return () => { alive = false }
  }, [])

  const handleLogin = async (e) => {
    e?.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError(L('يرجى إدخال اسم المستخدم وكلمة المرور', 'Veuillez saisir votre nom d\u2019utilisateur et votre mot de passe', 'Please enter your username and password'))
      return
    }
    setLoading(true)
    try {
      // المصادقة عبر الخادم المحلي (الحسابات الرسمية — كلمات مرور مشفرة bcrypt)
      const data = await api.login(username.trim(), password)
      const serverUser = { ...data.user, active: true }
      const serverPharmacy = data.pharmacy || null

      // تسجيل الجلسة محلياً (التوجيه تلقائي حسب الدور عبر ProtectedRoute)
      login(serverUser, serverPharmacy)

      // مزامنة مستخدمي وصيدليات الخادم إلى الواجهة (المصدر الموثوق)
      // — تُزيل بذلك أي بقايا لحسابات العرض التجريبي
      try {
        const [serverUsers, serverPharmacies] = await Promise.all([
          ['super_admin', 'admin'].includes(serverUser.role) ? api.fetchUsers() : Promise.resolve(null),
          api.fetchPharmacies(),
        ])
        if (serverUsers) importServerUsers(serverUsers)
        if (serverPharmacies) importServerPharmacies(serverPharmacies)
      } catch { /* الجلسة مسجلة — التحديثات الإضافية غير حرجة */ }
    } catch (err) {
      // الخادم ردّ بخطأ (بيانات خاطئة / حساب موقوف / محاولات كثيرة)
      if (err?.serverResponded) {
        setError(err.message || t('invalidCredentials'))
      } else {
        // تعذّر الوصول للخادم (شبكة/نفق) — لا سقوط على حسابات تجريبية
        setError(t('loginServerUnreachable'))
        setServerCheck('offline')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col p-4 bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-200 dark:bg-primary-700 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 dark:opacity-20 animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-200 dark:bg-blue-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 dark:opacity-20 animate-pulse-slow" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-100 dark:bg-primary-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-15" />
      </div>

      {/* Floating pills decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute text-4xl opacity-10 animate-pulse-slow"
            style={{
              top: `${(i * 13 + 7) % 100}%`,
              left: `${(i * 17 + 11) % 100}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + (i % 3)}s`
            }}
          >
            {['💊', '🩺', '⚕️', '🧬', '💉', '🧴', '🩹', '🩸'][i]}
          </div>
        ))}
      </div>

      {/* شريط علوي داخل تدفق الصفحة: اللغة + الوضع الفاتح/الداكن
          (كان مبدل اللغة مثبتاً بشكل مطلق فوق البطاقة فيتداخل معها على الهاتف) */}
      <div className="relative z-20 w-full flex flex-wrap items-center justify-end gap-2 py-1">
        <ThemeToggle variant="pill" />
        <LanguageSwitcher variant="pill" />
      </div>

      <div className="relative flex-1 flex items-center justify-center w-full">
        <div className="relative w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center z-10 py-8">
        {/* Left side - branding */}
        <div className="hidden lg:block space-y-6 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-2xl shadow-primary-500/40">
              <Stethoscope className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('appName')}</h1>
              <p className="text-sm text-gray-600">{t('appTagline')}</p>
            </div>
          </div>

          <h2 className="text-4xl xl:text-5xl font-bold text-gray-900 leading-tight text-balance">
            {L(
              'إدارة صيدليتك بذكاء واحترافية',
              'Gérez votre pharmacie avec intelligence et professionnalisme',
              'Manage your pharmacy intelligently and professionally'
            )}
          </h2>

          <p className="text-lg text-gray-600 max-w-md">
            {L(
              'نظام متكامل لإدارة المخزون، المبيعات، الوصفات الطبية، والمزيد - كل ذلك في مكان واحد.',
              'Un système complet pour la gestion des stocks, des ventes, des ordonnances et plus encore — tout en un seul endroit.',
              'A comprehensive system for inventory management, sales, prescriptions, and more — all in one place.'
            )}
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { icon: Pill, title: L('إدارة المخزون', 'Gestion des stocks', 'Inventory Management'), color: 'emerald' },
              { icon: ShieldCheck, title: L('أمان عالي', 'Sécurité renforcée', 'High Security'), color: 'blue' },
              { icon: Sparkles, title: L('سهولة الاستخدام', "Facile à utiliser", 'Easy to Use'), color: 'purple' },
              { icon: Building2, title: L('متعدد الفروع', 'Multi-pharmacies', 'Multi-branch'), color: 'amber' },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-4 border border-white/40 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all"
              >
                <div className={`w-10 h-10 rounded-lg bg-${feature.color}-100 flex items-center justify-center mb-2`}>
                  <feature.icon className={`w-5 h-5 text-${feature.color}-600`} />
                </div>
                <p className="text-sm font-semibold text-gray-900">{feature.title}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right side - login form */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-3xl shadow-2xl border border-white/40 dark:border-white/10 p-8 lg:p-10 animate-slide-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t('appName')}</h1>
              <p className="text-xs text-gray-600">{t('appTagline')}</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('staffEntrance')}</h2>
          <p className="text-sm text-gray-600 mb-4">{t('loginSubtitle')}</p>

          {/* مؤشر حالة الخادم — الدخول يستوجب اتصالاً بخادم المنصة */}
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-5 ${
            serverCheck === 'online' ? 'bg-emerald-50 text-emerald-700'
            : serverCheck === 'offline' ? 'bg-red-50 text-red-600'
            : 'bg-gray-100 text-gray-500'
          }`}>
            {serverCheck === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {serverCheck === 'online' && <Wifi className="w-3.5 h-3.5" />}
            {serverCheck === 'offline' && <WifiOff className="w-3.5 h-3.5" />}
            <span className="font-medium">
              {serverCheck === 'checking' ? t('serverChecking')
                : serverCheck === 'online' ? t('serverOnline')
                : t('serverOffline')}
            </span>
            {serverCheck === 'online' && <span className="text-emerald-600/70">•</span>}
            {serverCheck === 'online' && <span>{t('loginRealAccountsNote')}</span>}
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username */}
            <div>
              <label className="label flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary-600" />
                {t('username')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input ps-10"
                  placeholder={L('اسم المستخدم الرسمي', 'Nom d\u2019utilisateur officiel', 'Official username')}
                  autoComplete="username"
                  dir="ltr"
                  autoFocus
                />
                <UserIcon className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} w-4 h-4 text-gray-400`} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary-600" />
                {t('password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input ps-10 pe-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <Lock className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} w-4 h-4 text-gray-400`} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'} text-gray-400 hover:text-gray-600`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base font-semibold"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  {t('login')}
                </>
              )}
            </button>
          </form>

          {/* ===== دخول الزبناء (واجهة شراء الدواء) ===== */}
          <Link
            to="/shop"
            className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100 font-bold transition-all"
          >
            <ShoppingBag className="w-5 h-5" />
            {t('customerEntrance')} — {t('shopTitle')}
          </Link>

          {/* روابط الصفحات العامة */}
          <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-400">
            <Link to="/shop" className="hover:text-primary-600 transition-colors">{t('shopTitle')}</Link>
            <Link to="/download" className="hover:text-primary-600 transition-colors">{t('downloadApp')}</Link>
            <Link to="/about" className="hover:text-primary-600 transition-colors">{t('aboutUs')}</Link>
            <Link to="/guide" className="hover:text-primary-600 transition-colors">{t('howToUse')}</Link>
            <Link to="/terms" className="hover:text-primary-600 transition-colors">{t('termsOfUse')}</Link>
            <Link to="/privacy" className="hover:text-primary-600 transition-colors">{t('privacyPolicy')}</Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default Login
