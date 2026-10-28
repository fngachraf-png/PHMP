import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { Stethoscope, Lock, User as UserIcon, Building2, Eye, EyeOff, ShieldCheck, Pill, Sparkles, ShoppingBag } from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'

const Login = () => {
  const { t, language, login, pharmacies, users, isRTL, pickName } = useApp()
  const [selectedPharmacy, setSelectedPharmacy] = useState('ph1')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const L = (ar, fr, en) => language === 'ar' ? ar : language === 'fr' ? fr : en

  // منطق الدخول الفعلي - يستقبل القيم مباشرة لتفادي الإغلاق القديم (stale closure)
  const doLogin = (u, p, pharmacyId) => {
    setError('')
    setLoading(true)
    setTimeout(() => {
      const user = users.find(x => x.username === u && x.password === p)
      const pharmacy = pharmacies.find(ph => ph.id === (pharmacyId || selectedPharmacy))

      if (user) {
        if (user.active === false) {
          setError(t('accountSuspended'))
          setLoading(false)
          return
        }
        // السوبر أدمين (مالك المنصة) لا يرتبط بصيدلية محددة
        if (user.role === 'super_admin') {
          login(user, null)
        } else {
          login(user, pharmacy || pharmacies.find(ph => ph.id === user.pharmacyId))
        }
      } else {
        setError(t('invalidCredentials'))
      }
      setLoading(false)
    }, 600)
  }

  const handleLogin = (e) => {
    e?.preventDefault()
    doLogin(username, password)
  }

  const quickLogin = (role) => {
    const credentials = {
      super_admin: { username: 'superadmin', password: 'super123' },
      admin: { username: 'admin', password: 'admin' },
      accountant: { username: 'accountant', password: 'account' },
      pharmacist: { username: 'pharmacist', password: 'pharma' },
      cashier: { username: 'cashier', password: 'cashier' },
    }
    const cred = credentials[role]
    setUsername(cred.username)
    setPassword(cred.password)
    // اختيار الصيدلية المناسبة تلقائياً
    const user = users.find(u => u.username === cred.username)
    if (user?.pharmacyId) setSelectedPharmacy(user.pharmacyId)
    doLogin(cred.username, cred.password, user?.pharmacyId)
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 via-white to-primary-100 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-slow" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
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

      {/* Language switcher (عربي / Français / English) */}
      <div className="absolute top-6 z-10" style={{ [isRTL ? 'left' : 'right']: '1.5rem' }}>
        <LanguageSwitcher variant="pill" />
      </div>

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
                className="bg-white/60 backdrop-blur-md rounded-xl p-4 border border-white/40 hover:bg-white/80 transition-all"
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
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-white/40 p-8 lg:p-10 animate-slide-up">
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
          <p className="text-sm text-gray-600 mb-6">{t('loginSubtitle')}</p>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Pharmacy selection */}
            <div>
              <label className="label flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-600" />
                {t('selectPharmacy')}
              </label>
              <select
                value={selectedPharmacy}
                onChange={(e) => setSelectedPharmacy(e.target.value)}
                className="input"
              >
                {pharmacies.map(ph => (
                  <option key={ph.id} value={ph.id}>
                    {ph.logo} {pickName(ph)}
                  </option>
                ))}
              </select>
            </div>

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
                  placeholder="admin"
                  autoComplete="username"
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

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t('demoAccounts')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => quickLogin('super_admin')}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 hover:from-violet-100 hover:to-violet-200 transition-all border border-violet-200"
              >
                <span className="text-2xl">👑</span>
                <span className="text-xs font-semibold text-violet-800 text-center leading-tight">{t('loginAsSuperAdmin')}</span>
              </button>
              <button
                type="button"
                onClick={() => quickLogin('admin')}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 hover:from-primary-100 hover:to-primary-200 transition-all border border-primary-200"
              >
                <span className="text-2xl">👨‍⚕️</span>
                <span className="text-xs font-semibold text-primary-800">{t('loginAsAdmin')}</span>
              </button>
              <button
                type="button"
                onClick={() => quickLogin('accountant')}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 transition-all border border-amber-200"
              >
                <span className="text-2xl">📊</span>
                <span className="text-xs font-semibold text-amber-800">{t('loginAsAccountant')}</span>
              </button>
              <button
                type="button"
                onClick={() => quickLogin('pharmacist')}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition-all border border-blue-200"
              >
                <span className="text-2xl">👩‍⚕️</span>
                <span className="text-xs font-semibold text-blue-800">{t('loginAsPharmacist')}</span>
              </button>
              <button
                type="button"
                onClick={() => quickLogin('cashier')}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all border border-gray-200"
              >
                <span className="text-2xl">🧑‍💼</span>
                <span className="text-xs font-semibold text-gray-800">{t('loginAsCashier')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
