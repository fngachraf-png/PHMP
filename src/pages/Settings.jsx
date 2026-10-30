import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { ROLE_INFO } from '../config/permissions'
import { setApiUrl, getApiUrl, setApiKey, getApiKey } from '../lib/api'
import LogoUpload from '../components/LogoUpload'
import SmartAvatar, { isImage } from '../components/SmartAvatar'
import {
  Settings as SettingsIcon, Globe, Bell, Shield, Database,
  Building2, Users, Palette, Save, Mail, Phone, MapPin, FileText,
  Sun, Moon, Trash2, Download, Upload, Plus, Pencil, Wifi, RefreshCw, Crown
} from 'lucide-react'

const Settings = () => {
  const {
    t, isRTL, language, setLanguage, theme, setTheme, currentPharmacy, currentUser,
    visibleUsers, addUser, updateUser, deleteUser, hasPermission, pharmaciesData,
    serverStatus, syncToServer,
  pickName} = useApp()
  const [activeTab, setActiveTab] = useState('general')
  const [showUserModal, setShowUserModal] = useState(null)
  const [userForm, setUserForm] = useState({ name: '', username: '', password: '', role: 'pharmacist', pharmacyId: 'ph1', avatar: '👤' })
  const [apiUrlInput, setApiUrlInput] = useState(getApiUrl())
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey())
  const [syncing, setSyncing] = useState(false)
  const [notifications, setNotifications] = useState({
    lowStock: true,
    expiry: true,
    sales: false,
    prescriptions: true
  })

  const tabs = [
    { id: 'general', label: t('generalSettings'), icon: SettingsIcon },
    { id: 'pharmacy', label: t('pharmacyInfo'), icon: Building2 },
    { id: 'notifications', label: t('notifications'), icon: Bell },
    ...(hasPermission('users.view') ? [{ id: 'users', label: t('manageUsers'), icon: Users }] : []),
    { id: 'server', label: t('localServer'), icon: Wifi },
    { id: 'data', label: t('backup'), icon: Database },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-primary-600" />
          {t('settings')}
        </h1>
        <p className="text-sm text-gray-600 mt-1">{language === 'ar' ? 'إعدادات النظام' : language === 'fr' ? 'Paramètres du système' : 'System settings'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-2">
            {tabs.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'general' && (
            <div className="card p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{t('language')}</h3>
                <p className="text-sm text-gray-500 mb-4">{t('chooseLanguage')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'ar', label: 'العربية', sub: 'RTL', flag: '🇲🇦' },
                    { id: 'fr', label: 'Français', sub: 'LTR', flag: '🇫🇷' },
                    { id: 'en', label: 'English', sub: 'LTR', flag: '🇬🇧' },
                  ].map(lang => (
                    <button
                      key={lang.id}
                      onClick={() => setLanguage(lang.id)}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        language === lang.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-3xl">{lang.flag}</span>
                      <div className="text-start">
                        <p className="font-semibold text-gray-900">{lang.label}</p>
                        <p className="text-xs text-gray-500">{lang.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{t('theme')}</h3>
                <p className="text-sm text-gray-500 mb-4">{language === 'ar' ? 'اختر مظهر التطبيق' : language === 'fr' ? 'Choisir l\'apparence' : 'Choose app appearance'}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'light', label: language === 'ar' ? 'فاتح' : language === 'fr' ? 'Clair' : 'Light', icon: Sun, color: 'amber' },
                    { id: 'dark', label: language === 'ar' ? 'داكن' : language === 'fr' ? 'Sombre' : 'Dark', icon: Moon, color: 'indigo' },
                  ].map(t => {
                    const Icon = t.icon
                    const active = theme === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                          active ? `border-${t.color}-500 bg-${t.color}-50` : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-6 h-6 ${active ? `text-${t.color}-600` : 'text-gray-500'}`} />
                        <p className={`font-semibold ${active ? `text-${t.color}-700` : 'text-gray-700'}`}>{t.label}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pharmacy' && currentPharmacy && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <SmartAvatar
                  value={currentPharmacy.logo}
                  alt={currentPharmacy.name}
                  size={48}
                  rounded="rounded-xl"
                  textClass="text-2xl"
                  fallback="💊"
                  className="gradient-primary"
                />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{currentPharmacy.name}</h3>
                  <p className="text-sm text-gray-500">{currentPharmacy.license}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label flex items-center gap-1"><Phone className="w-3 h-3" /> {t('phone')}</label>
                  <input type="tel" defaultValue={currentPharmacy.phone} className="input" />
                </div>
                <div>
                  <label className="label flex items-center gap-1"><Mail className="w-3 h-3" /> {t('email')}</label>
                  <input type="email" defaultValue={currentPharmacy.email} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="label flex items-center gap-1"><MapPin className="w-3 h-3" /> {t('address')}</label>
                  <input type="text" defaultValue={currentPharmacy.address} className="input" />
                </div>
                <div>
                  <label className="label flex items-center gap-1"><FileText className="w-3 h-3" /> {language === 'ar' ? 'رقم الترخيص' : language === 'fr' ? 'Licence' : 'License'}</label>
                  <input type="text" defaultValue={currentPharmacy.license} className="input" />
                </div>
                <div>
                  <label className="label">{language === 'ar' ? 'الرقم الضريبي' : language === 'fr' ? 'ID fiscal' : 'Tax ID'}</label>
                  <input type="text" placeholder="TVA-XXX" className="input" />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button className="btn-primary">
                  <Save className="w-4 h-4" />
                  {t('save')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card p-6 space-y-3">
              <h3 className="text-lg font-bold mb-1">{t('notifications')}</h3>
              <p className="text-sm text-gray-500 mb-4">{language === 'ar' ? 'إعدادات التنبيهات' : language === 'fr' ? 'Paramètres des notifications' : 'Notification settings'}</p>

              {[
                { key: 'lowStock', label: t('lowStockAlerts'), desc: language === 'ar' ? 'تنبيه عند انخفاض المخزون' : language === 'fr' ? 'Alerte quand le stock est faible' : 'Alert when stock is low' },
                { key: 'expiry', label: t('expiryAlerts'), desc: language === 'ar' ? 'تنبيه قبل انتهاء الصلاحية' : language === 'fr' ? 'Alerte avant péremption' : 'Alert before products expire' },
                { key: 'sales', label: language === 'ar' ? 'تنبيهات المبيعات' : language === 'fr' ? 'Alertes ventes' : 'Sales Alerts', desc: language === 'ar' ? 'تنبيه لكل عملية بيع' : language === 'fr' ? 'Alerte à chaque vente' : 'Alert for each sale' },
                { key: 'prescriptions', label: language === 'ar' ? 'تنبيهات الوصفات' : language === 'fr' ? 'Alertes ordonnances' : 'Prescription Alerts', desc: language === 'ar' ? 'تنبيه للوصفات الجديدة' : language === 'fr' ? 'Alerte pour nouvelles ordonnances' : 'Alert for new prescriptions' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      notifications[item.key] ? 'bg-primary-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${
                      notifications[item.key]
                        ? isRTL ? 'right-0.5' : 'left-[22px]'
                        : isRTL ? 'right-[22px]' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'users' && hasPermission('users.view') && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">{t('manageUsers')}</h3>
                {hasPermission('users.manage') && (
                  <button
                    onClick={() => { setUserForm({ name: '', username: '', password: '', role: 'pharmacist', pharmacyId: currentUser?.pharmacyId || 'ph1', avatar: '👤' }); setShowUserModal('new') }}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4" />{t('addUser')}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {visibleUsers.map(u => {
                  const info = ROLE_INFO[u.role] || {}
                  const ph = pharmaciesData.find(p => p.id === u.pharmacyId)
                  return (
                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                      <SmartAvatar
                        value={u.avatar}
                        alt={u.name}
                        size={40}
                        rounded="rounded-full"
                        textClass="text-xl"
                        className={u.role === 'super_admin' ? 'bg-gradient-to-br from-violet-400 to-violet-600' : 'bg-gradient-to-br from-primary-400 to-primary-600'}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{u.name}</p>
                        <p className="text-xs text-gray-500">
                          {info.badge} {language === 'ar' ? info.ar : language === 'fr' ? (info.fr || info.en) : info.en}
                          {u.role !== 'super_admin' && ph ? ` • ${pickName(ph)}` : u.role === 'super_admin' ? ` • ${t('allPharmacies')}` : ''}
                        </p>
                      </div>
                      <span className={`badge ${u.active !== false ? 'badge-success' : 'badge-gray'}`}>
                        {u.active !== false ? (language === 'ar' ? 'نشط' : language === 'fr' ? 'Actif' : 'Active') : (language === 'ar' ? 'موقوف' : language === 'fr' ? 'Suspendu' : 'Inactive')}
                      </span>
                      {hasPermission('users.manage') && u.role !== 'super_admin' && u.id !== currentUser?.id && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setUserForm({ name: u.name, username: u.username, password: '', role: u.role, pharmacyId: u.pharmacyId, avatar: u.avatar }); setShowUserModal(u) }}
                            className="p-1.5 rounded-lg hover:bg-white text-gray-600"
                            title={t('edit')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if (window.confirm(language === 'ar' ? `حذف ${u.name}؟` : language === 'fr' ? `Supprimer ${u.name} ?` : `Delete ${u.name}?`)) deleteUser(u.id) }}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-red-600"
                            title={t('delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {u.role === 'super_admin' && <Crown className="w-4 h-4 text-violet-500" />}
                    </div>
                  )
                })}
              </div>
              {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowUserModal(null)}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
                    <h3 className="font-bold text-gray-900">{showUserModal === 'new' ? t('addUser') : `${t('edit')} - ${showUserModal.name}`}</h3>
                    {/* صورة المستخدم (موظف) — اختيارية */}
                    <LogoUpload
                      value={isImage(userForm.avatar) ? userForm.avatar : null}
                      onChange={(img) => setUserForm({ ...userForm, avatar: img || '👤' })}
                      label={t('userPhoto')}
                      hint={t('userPhotoHint')}
                      size={80}
                      rounded="rounded-full"
                    />
                    <div>
                      <label className="label">{t('name')} *</label>
                      <input className="input" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">{t('username')} *</label>
                      <input className="input" dir="ltr" value={userForm.username} disabled={showUserModal !== 'new'} onChange={e => setUserForm({ ...userForm, username: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">{t('password')} {showUserModal !== 'new' && `(${language === 'ar' ? 'فارغ = بدون تغيير' : language === 'fr' ? 'vide = conserver' : 'empty = keep'})`}</label>
                      <input type="password" className="input" dir="ltr" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">{t('role')}</label>
                        <select className="input" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                          {Object.entries(ROLE_INFO).filter(([k]) => k !== 'super_admin').map(([k, v]) => (
                            <option key={k} value={k}>{v.badge} {language === 'ar' ? v.ar : language === 'fr' ? (v.fr || v.en) : v.en}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">{t('selectPharmacy')}</label>
                        <select className="input" value={userForm.pharmacyId} onChange={e => setUserForm({ ...userForm, pharmacyId: e.target.value })}>
                          {pharmaciesData.map(ph => (
                            <option key={ph.id} value={ph.id}>{pickName(ph)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        className="btn-primary flex-1"
                        onClick={() => {
                          if (showUserModal === 'new') {
                            if (userForm.name && userForm.username && userForm.password) addUser(userForm)
                          } else {
                            const updates = { name: userForm.name, role: userForm.role, pharmacyId: userForm.pharmacyId }
                            if (isImage(userForm.avatar)) updates.avatar = userForm.avatar
                            if (userForm.password) updates.password = userForm.password
                            updateUser(showUserModal.id, updates)
                          }
                          setShowUserModal(null)
                        }}
                      >
                        <Save className="w-4 h-4" />{t('save')}
                      </button>
                      <button className="btn-secondary flex-1" onClick={() => setShowUserModal(null)}>{t('cancel')}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'server' && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{t('localServer')}</h3>
                <span className={`badge ${serverStatus.online ? 'badge-success' : 'badge-gray'}`}>
                  {serverStatus.online ? t('serverOnline') : t('serverOffline')}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {isRTL
                  ? 'اربط المنصة بقاعدة البيانات المحلية SQLite عبر النفق الدائم لتخزين مركزي ودائم للبيانات.'
                  : 'Connect the platform to the local SQLite database via the permanent tunnel for centralized, persistent data storage.'}
              </p>
              <div>
                <label className="label">{language === 'ar' ? 'عنوان الخادم (النفق)' : language === 'fr' ? 'URL du serveur (tunnel)' : 'Server URL (tunnel)'}</label>
                <div className="flex gap-2">
                  <input className="input" dir="ltr" value={apiUrlInput} onChange={e => setApiUrlInput(e.target.value)} placeholder="https://phmp-api.balbolghol-ai.workers.dev" />
                  <button className="btn-secondary" onClick={() => { setApiUrl(apiUrlInput); window.location.reload() }}>
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'مفتاح API (للمزامنة والنسخ الاحتياطي)' : language === 'fr' ? 'Clé API (synchro et sauvegarde)' : 'API key (sync & backup)'}</label>
                <div className="flex gap-2">
                  <input className="input" dir="ltr" type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="phmp_..." autoComplete="off" />
                  <button className="btn-secondary" onClick={() => { setApiKey(apiKeyInput); window.location.reload() }}>
                    <Save className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'ar'
                    ? 'مطلوب لمزامنة البيانات مع SQLite. يُحفظ في هذا المتصفح فقط.'
                    : language === 'fr'
                      ? 'Requis pour synchroniser avec SQLite. Stocké dans ce navigateur uniquement.'
                      : 'Required to sync with SQLite. Stored in this browser only.'}
                </p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('lastSync')}</p>
                  <p className="text-xs text-gray-500" dir="ltr">
                    {serverStatus.lastSync ? new Date(serverStatus.lastSync).toLocaleString() : '—'}
                  </p>
                </div>
                <button
                  className="btn-primary"
                  disabled={syncing || !serverStatus.online}
                  onClick={async () => { setSyncing(true); await syncToServer(); setSyncing(false) }}
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {t('syncNow')}
                </button>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-800">
                  {isRTL
                    ? 'ملاحظة: في غياب الخادم تعمل المنصة محلياً بكل الوظائف عبر التخزين المحلي للمتصفح. راجع دليل البيئة المحلية LOCAL_ENVIRONMENT.md لتنصيب الخادم والنفق.'
                    : 'Note: without the server, the platform works fully locally via browser storage. See LOCAL_ENVIRONMENT.md to install the server and tunnel.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="card p-6 space-y-4">
              <h3 className="text-lg font-bold mb-1">{t('backup')}</h3>
              <p className="text-sm text-gray-500 mb-4">{language === 'ar' ? 'إدارة النسخ الاحتياطية' : language === 'fr' ? 'Gestion des sauvegardes' : 'Manage backups'}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button className="p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-all text-start">
                  <Download className="w-6 h-6 text-primary-600 mb-2" />
                  <p className="font-semibold text-gray-900">{language === 'ar' ? 'تصدير البيانات' : language === 'fr' ? 'Exporter les données' : 'Export Data'}</p>
                  <p className="text-xs text-gray-500 mt-1">{language === 'ar' ? 'احفظ نسخة احتياطية' : language === 'fr' ? 'Enregistrer une sauvegarde' : 'Save backup'}</p>
                </button>
                <button className="p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-all text-start">
                  <Upload className="w-6 h-6 text-primary-600 mb-2" />
                  <p className="font-semibold text-gray-900">{language === 'ar' ? 'استيراد البيانات' : language === 'fr' ? 'Importer les données' : 'Import Data'}</p>
                  <p className="text-xs text-gray-500 mt-1">{language === 'ar' ? 'استرجع نسخة احتياطية' : language === 'fr' ? 'Restaurer une sauvegarde' : 'Restore backup'}</p>
                </button>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mt-4">
                <p className="text-sm font-semibold text-amber-900">💡 {language === 'ar' ? 'نصيحة' : language === 'fr' ? 'Conseil' : 'Tip'}</p>
                <p className="text-xs text-amber-800 mt-1">
                  {language === 'ar' ? 'قم بإجراء نسخ احتياطي بشكل منتظم للحفاظ على بياناتك آمنة' : language === 'fr' ? 'Effectuez des sauvegardes régulières pour protéger vos données' : 'Perform regular backups to keep your data safe'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings
