import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  Settings as SettingsIcon, Globe, Bell, Shield, Database,
  Building2, Users, Palette, Save, Mail, Phone, MapPin, FileText,
  Sun, Moon, Trash2, Download, Upload
} from 'lucide-react'

const Settings = () => {
  const { t, isRTL, language, setLanguage, theme, setTheme, currentPharmacy, currentUser } = useApp()
  const [activeTab, setActiveTab] = useState('general')
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
    { id: 'users', label: t('manageUsers'), icon: Users },
    { id: 'data', label: t('backup'), icon: Database },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-primary-600" />
          {t('settings')}
        </h1>
        <p className="text-sm text-gray-600 mt-1">{isRTL ? 'إعدادات النظام' : 'System settings'}</p>
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
                <p className="text-sm text-gray-500 mb-4">{isRTL ? 'اختر لغة الواجهة' : 'Choose interface language'}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'ar', label: 'العربية', flag: '🇲🇦' },
                    { id: 'en', label: 'English', flag: '🇬🇧' },
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
                        <p className="text-xs text-gray-500">{lang.id === 'ar' ? 'RTL' : 'LTR'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{t('theme')}</h3>
                <p className="text-sm text-gray-500 mb-4">{isRTL ? 'اختر مظهر التطبيق' : 'Choose app appearance'}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'light', label: isRTL ? 'فاتح' : 'Light', icon: Sun, color: 'amber' },
                    { id: 'dark', label: isRTL ? 'داكن' : 'Dark', icon: Moon, color: 'indigo' },
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
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-2xl">
                  {currentPharmacy.logo}
                </div>
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
                  <label className="label flex items-center gap-1"><FileText className="w-3 h-3" /> {isRTL ? 'رقم الترخيص' : 'License'}</label>
                  <input type="text" defaultValue={currentPharmacy.license} className="input" />
                </div>
                <div>
                  <label className="label">{isRTL ? 'الرقم الضريبي' : 'Tax ID'}</label>
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
              <p className="text-sm text-gray-500 mb-4">{isRTL ? 'إعدادات التنبيهات' : 'Notification settings'}</p>

              {[
                { key: 'lowStock', label: t('lowStockAlerts'), desc: isRTL ? 'تنبيه عند انخفاض المخزون' : 'Alert when stock is low' },
                { key: 'expiry', label: t('expiryAlerts'), desc: isRTL ? 'تنبيه قبل انتهاء الصلاحية' : 'Alert before products expire' },
                { key: 'sales', label: isRTL ? 'تنبيهات المبيعات' : 'Sales Alerts', desc: isRTL ? 'تنبيه لكل عملية بيع' : 'Alert for each sale' },
                { key: 'prescriptions', label: isRTL ? 'تنبيهات الوصفات' : 'Prescription Alerts', desc: isRTL ? 'تنبيه للوصفات الجديدة' : 'Alert for new prescriptions' },
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

          {activeTab === 'users' && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">{t('manageUsers')}</h3>
                <button className="btn-primary"><Users className="w-4 h-4" />{isRTL ? 'إضافة مستخدم' : 'Add User'}</button>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'محمد الإدريسي', role: 'admin', avatar: '👨‍⚕️', active: true },
                  { name: 'فاطمة الزهراء', role: 'pharmacist', avatar: '👩‍⚕️', active: true },
                  { name: 'يوسف بن علي', role: 'cashier', avatar: '🧑‍💼', active: true },
                ].map((user, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-2xl">
                      {user.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                    </div>
                    <span className={`badge ${user.active ? 'badge-success' : 'badge-gray'}`}>
                      {user.active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'موقوف' : 'Inactive')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="card p-6 space-y-4">
              <h3 className="text-lg font-bold mb-1">{t('backup')}</h3>
              <p className="text-sm text-gray-500 mb-4">{isRTL ? 'إدارة النسخ الاحتياطية' : 'Manage backups'}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button className="p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-all text-start">
                  <Download className="w-6 h-6 text-primary-600 mb-2" />
                  <p className="font-semibold text-gray-900">{isRTL ? 'تصدير البيانات' : 'Export Data'}</p>
                  <p className="text-xs text-gray-500 mt-1">{isRTL ? 'احفظ نسخة احتياطية' : 'Save backup'}</p>
                </button>
                <button className="p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-all text-start">
                  <Upload className="w-6 h-6 text-primary-600 mb-2" />
                  <p className="font-semibold text-gray-900">{isRTL ? 'استيراد البيانات' : 'Import Data'}</p>
                  <p className="text-xs text-gray-500 mt-1">{isRTL ? 'استرجع نسخة احتياطية' : 'Restore backup'}</p>
                </button>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mt-4">
                <p className="text-sm font-semibold text-amber-900">💡 {isRTL ? 'نصيحة' : 'Tip'}</p>
                <p className="text-xs text-amber-800 mt-1">
                  {isRTL ? 'قم بإجراء نسخ احتياطي بشكل منتظم للحفاظ على بياناتك آمنة' : 'Perform regular backups to keep your data safe'}
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
