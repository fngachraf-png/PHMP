import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../contexts/AppContext'
import { api } from '../lib/api'
import { NoPermission } from '../components/PermissionGate'
import { ROLE_INFO, roleHasPermission } from '../config/permissions'
import LogoUpload from '../components/LogoUpload'
import SmartAvatar, { isImage } from '../components/SmartAvatar'
import {
  Crown, Building2, Users, TrendingUp, ShoppingCart, Plus, Trash2, Pencil,
  History, ShieldCheck, X, Check, ChevronDown, Activity
} from 'lucide-react'

// نافذة إضافة/تعديل مستخدم
const UserModal = ({ user, onClose }) => {
  const { t, isRTL, pharmaciesData, addUser, updateUser, usersData, pickName, language, serverStatus } = useApp()
  const [form, setForm] = useState(user || {
    name: '', username: '', password: '', role: 'pharmacist', pharmacyId: 'ph1', avatar: '👤',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const roles = Object.entries(ROLE_INFO).filter(([key]) => key !== 'super_admin')

  const submit = async () => {
    if (!form.name || !form.username || (!user && !form.password)) {
      setError(language === 'ar' ? 'يرجى ملء جميع الحقول الإلزامية' : language === 'fr' ? 'Veuillez remplir tous les champs obligatoires' : 'Please fill all required fields')
      return
    }
    if (!user && usersData.some(u => u.username === form.username)) {
      setError(t('usernameTaken'))
      return
    }
    if (!user && form.password.length < 4) {
      setError(t('passwordTooShort'))
      return
    }
    setSaving(true)
    setError('')
    try {
      if (user) {
        const updates = { name: form.name, role: form.role, pharmacyId: form.pharmacyId }
        if (isImage(form.avatar)) updates.avatar = form.avatar
        if (form.password) updates.password = form.password
        await updateUser(user.id, updates)
      } else {
        await addUser(form)
      }
      onClose()
    } catch (err) {
      setError(err?.message || (language === 'ar' ? 'فشل الحفظ على الخادم' : language === 'fr' ? 'Échec de l\u2019enregistrement sur le serveur' : 'Failed to save on server'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{user ? (language === 'ar' ? 'تعديل مستخدم' : language === 'fr' ? 'Modifier un utilisateur' : 'Edit User') : t('addUser')}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* صورة المستخدم (موظف) — اختيارية */}
          <LogoUpload
            value={isImage(form.avatar) ? form.avatar : null}
            onChange={(img) => setForm({ ...form, avatar: img || '👤' })}
            label={t('userPhoto')}
            hint={t('userPhotoHint')}
            size={80}
            rounded="rounded-full"
          />
          <div>
            <label className="label">{t('name')} *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('username')} *</label>
            <input className="input" value={form.username} disabled={!!user} onChange={e => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('password')} {user ? `(${language === 'ar' ? 'اتركها فارغة للإبقاء' : language === 'fr' ? 'laisser vide pour conserver' : 'leave empty to keep'})` : '*'}</label>
            <input type="password" className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('role')} *</label>
            <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {roles.map(([key, info]) => (
                <option key={key} value={key}>{info.badge} {language === 'ar' ? info.ar : language === 'fr' ? (info.fr || info.en) : info.en}</option>
              ))}
            </select>
          </div>
          {form.role !== 'super_admin' && (
            <div>
              <label className="label">{t('selectPharmacy')} *</label>
              <select className="input" value={form.pharmacyId} onChange={e => setForm({ ...form, pharmacyId: e.target.value })}>
                {pharmaciesData.map(ph => (
                  <option key={ph.id} value={ph.id}>{ph.logo} {pickName(ph)}</option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={saving} className="btn-primary flex-1">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {t('save')}
            </button>
            <button onClick={onClose} disabled={saving} className="btn-secondary flex-1">{t('cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// نافذة إضافة صيدلية
const PharmacyModal = ({ onClose }) => {
  const { t, isRTL, addPharmacy, language, serverStatus } = useApp()
  const [form, setForm] = useState({ name: '', nameEn: '', address: '', phone: '', email: '', license: '', logo: '💊' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.name || !form.license) {
      setError(language === 'ar' ? 'يرجى إدخال الاسم ورقم الترخيص' : language === 'fr' ? 'Veuillez saisir le nom et le numéro de licence' : 'Please enter name and license number')
      return
    }
    setSaving(true)
    setError('')
    try {
      await addPharmacy({ ...form, nameEn: form.nameEn || form.name, color: 'blue' })
      onClose()
    } catch (err) {
      setError(err?.message || (language === 'ar' ? 'فشل الحفظ على الخادم' : language === 'fr' ? 'Échec de l\u2019enregistrement sur le serveur' : 'Failed to save on server'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{t('addPharmacy')}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* لوغو الصيدلية (صورة) — يُستعمل في الواجهة وفي الفواتير والتقارير */}
          <LogoUpload
            value={isImage(form.logo) ? form.logo : null}
            onChange={(img) => setForm({ ...form, logo: img || '💊' })}
            label={t('pharmacyLogo')}
            hint={t('pharmacyLogoHint')}
            size={88}
            rounded="rounded-2xl"
          />
          <div>
            <label className="label">{t('pharmacyName')} *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="صيدلية ..." />
          </div>
          <div>
            <label className="label">Name (EN)</label>
            <input className="input" value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} placeholder="Pharmacy ..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('licenseNumber')} *</label>
              <input className="input" value={form.license} onChange={e => setForm({ ...form, license: e.target.value })} placeholder="PH-2025-XXX" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'الرمز البديل (بدون صورة)' : language === 'fr' ? 'Emoji (sans image)' : 'Emoji (no image)'}</label>
              <input className="input" maxLength={4} value={isImage(form.logo) ? '' : form.logo} disabled={isImage(form.logo)} onChange={e => setForm({ ...form, logo: e.target.value || '💊' })} />
            </div>
          </div>
          <div>
            <label className="label">{t('address')}</label>
            <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('phone')}</label>
              <input className="input" dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('email')}</label>
              <input type="email" className="input" dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={saving} className="btn-primary flex-1">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {t('save')}
            </button>
            <button onClick={onClose} disabled={saving} className="btn-secondary flex-1">{t('cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const Platform = () => {
  const {
    t, isRTL, language, hasPermission, pharmaciesData, usersData, salesData,
    productsData, customersData, auditLog, deleteUser, updateUser, serverStatus, syncToServer, currentUser,
    pickName, importServerUsers,
  } = useApp()
  const [tab, setTab] = useState('overview')
  const [showUserModal, setShowUserModal] = useState(null) // null | 'new' | user object
  const [showPharmacyModal, setShowPharmacyModal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [actionError, setActionError] = useState('') // أخطاء عمليات الحذف/التعطيل من الخادم

  // تحديث قائمة المستخدمين من الخادم عند فتح الصفحة (المصدر الموثوق: SQLite)
  // يعوّض مستخدمي العرض التجريبي بمستخدمي المنصة الحقيقيين.
  const refreshServerUsers = useCallback(async () => {
    if (!serverStatus.online) return
    if (!currentUser || !['super_admin', 'admin'].includes(currentUser.role)) return
    try {
      const serverUsers = await api.fetchUsers()
      if (serverUsers) importServerUsers(serverUsers)
    } catch { /* الجلسة منتهية أو الخادم مشغول — تبقى القائمة المحلية */ }
  }, [serverStatus.online, currentUser, importServerUsers])

  useEffect(() => {
    refreshServerUsers()
  }, [refreshServerUsers])

  // حذف/تعطيل مع معالجة أخطاء الخادم
  const handleToggleActive = async (u) => {
    setActionError('')
    try {
      await updateUser(u.id, { active: !u.active })
    } catch (err) {
      setActionError(err?.message || '')
    }
  }

  const handleDeleteUser = async (u) => {
    setActionError('')
    const msg = language === 'ar' ? `حذف المستخدم ${u.name}؟` : language === 'fr' ? `Supprimer l'utilisateur ${u.name} ?` : `Delete user ${u.name}?`
    if (!window.confirm(msg)) return
    try {
      await deleteUser(u.id)
    } catch (err) {
      setActionError(err?.message || '')
    }
  }

  if (!hasPermission('platform.manage')) return <NoPermission />

  const tabs = [
    { id: 'overview', label: t('platformOverview'), icon: Activity },
    { id: 'pharmacies', label: t('managePharmacies'), icon: Building2 },
    { id: 'users', label: t('manageUsersAll'), icon: Users },
    { id: 'audit', label: t('auditLog'), icon: History },
  ]

  const totalRevenue = salesData.reduce((sum, s) => sum + (s.total || 0), 0)
  const stats = [
    { label: t('totalPharmacies'), value: pharmaciesData.length, icon: Building2, color: 'bg-blue-50 text-blue-600' },
    { label: t('totalUsersCount'), value: usersData.length, icon: Users, color: 'bg-violet-50 text-violet-600' },
    { label: t('platformRevenue'), value: `${totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${t('currency')}`, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
    { label: t('platformSalesCount'), value: salesData.length, icon: ShoppingCart, color: 'bg-amber-50 text-amber-600' },
  ]

  const roleLabel = (role) => {
    const info = ROLE_INFO[role]
    return info ? (language === 'ar' ? info.ar : info.en) : role
  }

  // مصفوفة الصلاحيات — مشتقة مباشرة من PERMISSIONS (مصدر الحقيقة الوحيد)
  // لا تُكتب قوائم الأدوار يدوياً هنا كي لا تنحرف عن السلوك الفعلي للتطبيق
  const matrixColumns = [
    { key: 'inventory', label: t('inventory'), permission: 'inventory.view' },
    { key: 'pos', label: t('pos'), permission: 'pos.use' },
    { key: 'reports', label: t('reports'), permission: 'reports.view' },
    { key: 'users', label: t('manageUsers'), permission: 'users.view' },
    { key: 'platform', label: t('platform'), permission: 'platform.manage' },
  ]

  const formatTime = (iso) => {
    try {
      const d = new Date(iso)
      return d.toLocaleString(language === 'ar' ? 'ar-MA' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    await syncToServer()
    setSyncing(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="w-7 h-7 text-violet-600" />
            {t('platform')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {language === 'ar' ? 'لوحة تحكم مالك المنصة؛ إشراف شامل على جميع الصيدليات والمستخدمين' : language === 'fr' ? 'Panneau de contrôle du propriétaire ; supervision complète de toutes les pharmacies et utilisateurs' : 'Platform owner control panel; full oversight of all pharmacies and users'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg ${serverStatus.online ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
            <span className={`w-2 h-2 rounded-full ${serverStatus.online ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {serverStatus.online ? t('serverOnline') : t('serverOffline')}
          </div>
          <button onClick={handleSync} disabled={syncing} className="btn-secondary text-sm">
            <TrendingUp className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
            {t('syncNow')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map(tabItem => {
          const Icon = tabItem.icon
          const active = tab === tabItem.id
          return (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active ? 'bg-violet-600 text-white shadow-md shadow-violet-500/30' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tabItem.label}
            </button>
          )
        })}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="card p-4 lg:p-5">
                <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
                  <stat.icon className="w-5 h-5 lg:w-6 lg:h-6" />
                </div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-lg lg:text-2xl font-bold text-gray-900 mt-1 break-all">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Per-pharmacy breakdown */}
          <div className="card p-4 lg:p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-600" />
              {t('managePharmacies')}
            </h3>
            <div className="space-y-3">
              {pharmaciesData.map(ph => {
                const phUsers = usersData.filter(u => u.pharmacyId === ph.id)
                const phSales = salesData.filter(s => s.pharmacyId === ph.id || !s.pharmacyId)
                return (
                  <div key={ph.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <SmartAvatar value={ph.logo} alt={pickName(ph)} size={36} rounded="rounded-xl" fallback="💊" className="bg-white border border-gray-200" textClass="text-2xl" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{pickName(ph)}</p>
                      <p className="text-xs text-gray-500 truncate">{ph.address} • {ph.license}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{phUsers.length}</span>
                      <span className="flex items-center gap-1"><ShoppingCart className="w-3.5 h-3.5" />{phSales.length}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Roles matrix — جدول حقيقي بحدود ورؤوس واضحة مشتق من PERMISSIONS */}
          <div className="card p-4 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-violet-600" />
                {t('rolesMatrix')}
              </h3>
              {/* مفتاح الرموز */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50">
                    <Check className="w-3 h-3 text-emerald-600" />
                  </span>
                  {language === 'ar' ? 'مسموح' : language === 'fr' ? 'Autorisé' : 'Allowed'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100">
                    <X className="w-3 h-3 text-gray-400" />
                  </span>
                  {language === 'ar' ? 'غير مسموح' : language === 'fr' ? 'Refusé' : 'Denied'}
                </span>
              </div>
            </div>
            <div className="table-container">
              <table className="table min-w-[560px]">
                <thead>
                  <tr>
                    <th className="min-w-[140px]">{t('role')}</th>
                    {matrixColumns.map(col => (
                      <th key={col.key} className="text-center whitespace-nowrap">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ROLE_INFO).map(([role, info]) => (
                    <tr key={role}>
                      <td className="font-medium">
                        <span className="me-1.5">{info.badge}</span>
                        {language === 'ar' ? info.ar : language === 'fr' ? (info.fr || info.en) : info.en}
                      </td>
                      {matrixColumns.map(col => {
                        const allowed = roleHasPermission(role, col.permission)
                        return (
                          <td key={col.key} className="text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${allowed ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                              {allowed
                                ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                                : <X className="w-3.5 h-3.5 text-gray-400" />}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {isRTL
                ? 'مالك المنصة يملك جميع الصلاحيات، يليه المدير (صيدليته فقط)، ثم المحاسب (المالية والمشتريات)، ثم الصيدلاني (الصرف والمخزون)، ثم الكاشير (نقطة البيع فقط).'
                : 'The platform owner holds all permissions, followed by the manager (own pharmacy), accountant (finance & purchases), pharmacist (dispensing & inventory), and cashier (POS only).'}
            </p>
          </div>
        </div>
      )}

      {/* Pharmacies tab */}
      {tab === 'pharmacies' && (
        <div className="card p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{t('managePharmacies')}</h3>
            <button onClick={() => setShowPharmacyModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('addPharmacy')}</span>
            </button>
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs text-gray-500 border-b border-gray-200">
                  <th className="text-start py-3 px-2">{t('pharmacyName')}</th>
                  <th className="text-start py-3 px-2">{t('licenseNumber')}</th>
                  <th className="text-start py-3 px-2">{t('city')}</th>
                  <th className="text-start py-3 px-2">{t('phone')}</th>
                  <th className="text-start py-3 px-2">{t('branchesCount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pharmaciesData.map(ph => {
                  const phUsers = usersData.filter(u => u.pharmacyId === ph.id)
                  return (
                    <tr key={ph.id} className="hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium text-gray-900">
                        <span className="inline-flex items-center gap-1.5 align-middle"><SmartAvatar value={ph.logo} alt={pickName(ph)} size={22} rounded="rounded-lg" fallback="💊" textClass="text-base" />{pickName(ph)}</span>
                      </td>
                      <td className="py-3 px-2 text-gray-600" dir="ltr">{ph.license}</td>
                      <td className="py-3 px-2 text-gray-600">{ph.address?.split('،').pop()?.trim() || t('notSpecified')}</td>
                      <td className="py-3 px-2 text-gray-600" dir="ltr">{ph.phone}</td>
                      <td className="py-3 px-2">
                        <span className="badge badge-primary">{phUsers.length}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {pharmaciesData.map(ph => {
              const phUsers = usersData.filter(u => u.pharmacyId === ph.id)
              return (
                <div key={ph.id} className="p-4 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <SmartAvatar value={ph.logo} alt={pickName(ph)} size={32} rounded="rounded-lg" fallback="💊" textClass="text-2xl" />
                    <p className="font-semibold text-gray-900">{pickName(ph)}</p>
                  </div>
                  <p className="text-xs text-gray-500">{ph.address}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600" dir="ltr">{ph.license} • {ph.phone}</span>
                    <span className="badge badge-primary">{phUsers.length} 👤</span>
                  </div>
                </div>
              )
            })}
          </div>
          {showPharmacyModal && <PharmacyModal onClose={() => setShowPharmacyModal(false)} />}
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="card p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{t('manageUsersAll')}</h3>
            <div className="flex items-center gap-2">
              <button onClick={refreshServerUsers} disabled={!serverStatus.online} className="btn-secondary text-sm" title={serverStatus.online ? '' : (language === 'ar' ? 'الخادم غير متصل' : language === 'fr' ? 'Serveur hors ligne' : 'Server offline')}>
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'ar' ? 'تحديث' : language === 'fr' ? 'Actualiser' : 'Refresh'}</span>
              </button>
              <button onClick={() => setShowUserModal('new')} className="btn-primary">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('addUser')}</span>
              </button>
            </div>
          </div>
          {actionError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{actionError}</div>
          )}
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs text-gray-500 border-b border-gray-200">
                  <th className="text-start py-3 px-2">{t('user')}</th>
                  <th className="text-start py-3 px-2">{t('role')}</th>
                  <th className="text-start py-3 px-2">{t('selectPharmacy')}</th>
                  <th className="text-start py-3 px-2">{t('status')}</th>
                  <th className="text-start py-3 px-2">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersData.map(u => {
                  const ph = pharmaciesData.find(p => p.id === u.pharmacyId)
                  const info = ROLE_INFO[u.role] || {}
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <SmartAvatar value={u.avatar} alt={u.name} size={34} rounded="rounded-full" textClass="text-xl" />
                          <div>
                            <p className="font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-500" dir="ltr">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`badge ${u.role === 'super_admin' ? 'bg-violet-100 text-violet-700' : 'badge-gray'}`}>
                          {info.badge} {roleLabel(u.role)}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-gray-600">
                        {u.role === 'super_admin' ? '👑 ' + t('allPharmacies') : (ph ? <span className="inline-flex items-center gap-1"><SmartAvatar value={ph.logo} alt="" size={18} rounded="rounded-md" fallback="💊" textClass="text-sm" />{pickName(ph)}</span> : t('notSpecified'))}
                      </td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={u.role === 'super_admin'}
                          className={`badge ${u.active ? 'badge-success' : 'badge-gray'} ${u.role !== 'super_admin' ? 'cursor-pointer hover:opacity-80' : 'opacity-100'}`}
                        >
                          {u.active ? t('active') : t('inactive')}
                        </button>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowUserModal(u)}
                            disabled={u.role === 'super_admin'}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-40"
                            title={t('edit')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={u.role === 'super_admin'}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-40"
                            title={t('delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {usersData.map(u => {
              const ph = pharmaciesData.find(p => p.id === u.pharmacyId)
              const info = ROLE_INFO[u.role] || {}
              return (
                <div key={u.id} className="p-4 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center gap-3">
                    <SmartAvatar value={u.avatar} alt={u.name} size={40} rounded="rounded-full" textClass="text-2xl" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-500" dir="ltr">@{u.username}</p>
                    </div>
                    <span className={`badge ${u.role === 'super_admin' ? 'bg-violet-100 text-violet-700' : 'badge-gray'}`}>
                      {info.badge}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600">{roleLabel(u.role)} • {u.role === 'super_admin' ? t('allPharmacies') : (ph ? (isRTL ? ph.name.split(' /')[0] : ph.nameEn) : t('notSpecified'))}</p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={u.role === 'super_admin'}
                        className={`badge ${u.active ? 'badge-success' : 'badge-gray'}`}
                      >
                        {u.active ? t('active') : t('inactive')}
                      </button>
                      <button onClick={() => setShowUserModal(u)} disabled={u.role === 'super_admin'} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-40"><Pencil className="w-4 h-4" /></button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={u.role === 'super_admin'}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {showUserModal && <UserModal user={showUserModal === 'new' ? null : showUserModal} onClose={() => setShowUserModal(null)} />}
        </div>
      )}

      {/* Audit tab */}
      {tab === 'audit' && (
        <div className="card p-4 lg:p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-violet-600" />
            {t('auditLog')}
            <span className="badge badge-gray">{auditLog.length}</span>
          </h3>
          {auditLog.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">{t('noAuditEntries')}</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {auditLog.map(entry => {
                const info = ROLE_INFO[entry.userRole] || {}
                return (
                  <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${entry.userRole === 'super_admin' ? 'bg-violet-100' : 'bg-primary-100'}`}>
                      {info.badge || '👤'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="font-medium text-sm text-gray-900">{entry.userName}</p>
                        <span className="text-[10px] text-gray-500">{roleLabel(entry.userRole)}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-700" dir="ltr">
                          {entry.action}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatTime(entry.timestamp)}
                        {entry.details && Object.keys(entry.details).length > 0 && (
                          <span className="mx-1">•</span>
                        )}
                        {entry.details && typeof entry.details === 'object' && (
                          <span dir="ltr" className="font-mono text-[10px]">
                            {Object.entries(entry.details).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40)}`).join(' | ')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Platform
