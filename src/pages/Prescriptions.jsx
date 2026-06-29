import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import {
  Plus, Search, FileText, User, Stethoscope, Pill, Clock,
  Check, X, AlertCircle, Calendar, Edit, Trash2
} from 'lucide-react'

const Prescriptions = () => {
  const { t, isRTL, prescriptionsData, customersData, productsData, addPrescription, updatePrescription } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState(null)

  const [formData, setFormData] = useState({
    patientId: '', patientName: '', doctorName: '', diagnosis: '',
    medications: [], notes: '', status: 'pending'
  })

  const [newMed, setNewMed] = useState({ productId: '', dosage: '', duration: '' })

  const filtered = prescriptionsData.filter(p => {
    const matchSearch = !searchQuery ||
      p.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.doctorName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  const getStatusInfo = (status) => {
    const map = {
      pending: { label: t('pending'), class: 'badge-warning' },
      dispensed: { label: t('dispensed'), class: 'badge-success' },
      cancelled: { label: t('cancelled'), class: 'badge-danger' }
    }
    return map[status] || map.pending
  }

  const openNewModal = () => {
    setFormData({
      patientId: '', patientName: '', doctorName: '', diagnosis: '',
      medications: [], notes: '', status: 'pending'
    })
    setShowModal(true)
  }

  const addMedication = () => {
    if (!newMed.productId) return
    const product = productsData.find(p => p.id === newMed.productId)
    if (!product) return
    setFormData({
      ...formData,
      medications: [...formData.medications, {
        productId: product.id,
        name: isRTL ? product.name : product.nameEn,
        dosage: newMed.dosage,
        duration: newMed.duration
      }]
    })
    setNewMed({ productId: '', dosage: '', duration: '' })
  }

  const removeMedication = (index) => {
    setFormData({
      ...formData,
      medications: formData.medications.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const patient = customersData.find(c => c.id === formData.patientId)
    const prescription = {
      ...formData,
      number: `RX-2026-${String(Date.now()).slice(-3)}`,
      patientName: patient?.name || formData.patientName,
      date: new Date().toISOString().split('T')[0]
    }
    addPrescription(prescription)
    setShowModal(false)
  }

  const stats = {
    total: prescriptionsData.length,
    pending: prescriptionsData.filter(p => p.status === 'pending').length,
    dispensed: prescriptionsData.filter(p => p.status === 'dispensed').length,
    cancelled: prescriptionsData.filter(p => p.status === 'cancelled').length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary-600" />
            {t('prescriptions')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{isRTL ? 'إدارة الوصفات الطبية' : 'Manage medical prescriptions'}</p>
        </div>
        <button onClick={openNewModal} className="btn-primary">
          <Plus className="w-4 h-4" />
          {t('addPrescription')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('all'), value: stats.total, color: 'blue' },
          { label: t('pending'), value: stats.pending, color: 'amber' },
          { label: t('dispensed'), value: stats.dispensed, color: 'emerald' },
          { label: t('cancelled'), value: stats.cancelled, color: 'red' },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search')}
              className="input ps-10"
            />
            <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} w-4 h-4 text-gray-400`} />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input lg:w-48"
          >
            <option value="all">{t('all')} {t('status')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="dispensed">{t('dispensed')}</option>
            <option value="cancelled">{t('cancelled')}</option>
          </select>
        </div>
      </div>

      {/* Prescriptions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(rx => {
          const status = getStatusInfo(rx.status)
          return (
            <div key={rx.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{rx.number}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {rx.date}
                    </p>
                  </div>
                </div>
                <span className={`badge ${status.class} text-xs`}>{status.label}</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{rx.patientName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{rx.doctorName}</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span className="text-gray-700 text-xs">{rx.diagnosis}</span>
                </div>
                <div className="flex items-start gap-2 pt-2 border-t border-gray-100">
                  <Pill className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-700">{t('medications')} ({rx.medications.length})</p>
                    <ul className="mt-1 space-y-0.5">
                      {rx.medications.slice(0, 2).map((m, i) => (
                        <li key={i} className="text-xs text-gray-600 truncate">• {m.name}</li>
                      ))}
                      {rx.medications.length > 2 && (
                        <li className="text-xs text-primary-600">+ {rx.medications.length - 2} {isRTL ? 'أخرى' : 'more'}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                {rx.status === 'pending' && (
                  <>
                    <button
                      onClick={() => updatePrescription(rx.id, { status: 'dispensed' })}
                      className="btn-primary text-xs flex-1 py-1.5"
                    >
                      <Check className="w-3 h-3" />
                      {t('dispensed')}
                    </button>
                    <button
                      onClick={() => updatePrescription(rx.id, { status: 'cancelled' })}
                      className="btn-danger text-xs flex-1 py-1.5"
                    >
                      <X className="w-3 h-3" />
                      {t('cancelled')}
                    </button>
                  </>
                )}
                {rx.status === 'dispensed' && (
                  <button className="btn-secondary text-xs flex-1 py-1.5" onClick={() => setSelectedPrescription(rx)}>
                    <FileText className="w-3 h-3" />
                    {t('view')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('noData')}</p>
        </div>
      )}

      {/* Add Prescription Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="text-xl font-bold text-gray-900">{t('addPrescription')}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t('patientName')}</label>
                  <select
                    value={formData.patientId}
                    onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="">{isRTL ? 'اختر مريض' : 'Select patient'}</option>
                    {customersData.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('doctorName')}</label>
                  <input
                    type="text"
                    value={formData.doctorName}
                    onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                    className="input"
                    placeholder={isRTL ? 'د. اسم الطبيب' : 'Dr. Name'}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('diagnosis')}</label>
                <input
                  type="text"
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  className="input"
                  placeholder={isRTL ? 'مثال: التهاب الحلق' : 'e.g., Sore throat'}
                  required
                />
              </div>

              <div>
                <label className="label">{t('medications')}</label>
                <div className="space-y-2 mb-2">
                  {formData.medications.map((med, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <Pill className="w-4 h-4 text-primary-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{med.name}</p>
                        <p className="text-xs text-gray-500">{med.dosage} • {med.duration}</p>
                      </div>
                      <button type="button" onClick={() => removeMedication(i)} className="text-red-600 hover:bg-red-50 p-1 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-12 gap-2 p-3 bg-primary-50 rounded-lg">
                  <select
                    value={newMed.productId}
                    onChange={(e) => setNewMed({ ...newMed, productId: e.target.value })}
                    className="input col-span-5 text-sm"
                  >
                    <option value="">{isRTL ? 'اختر دواء' : 'Select med'}</option>
                    {productsData.filter(p => p.requiresPrescription).map(p => (
                      <option key={p.id} value={p.id}>{isRTL ? p.name : p.nameEn}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newMed.dosage}
                    onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                    placeholder={isRTL ? 'الجرعة' : 'Dosage'}
                    className="input col-span-4 text-sm"
                  />
                  <input
                    type="text"
                    value={newMed.duration}
                    onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                    placeholder={isRTL ? 'المدة' : 'Duration'}
                    className="input col-span-2 text-sm"
                  />
                  <button type="button" onClick={addMedication} className="btn-primary text-sm py-2 px-3 col-span-1">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="label">{t('notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary">
                  <Save className="w-4 h-4" />
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Prescriptions
