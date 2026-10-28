import { useState } from 'react'
import { useApp } from '../contexts/AppContext'
import { legalReferences, officialAuthorities } from '../data/legalReferences'
import { NoPermission } from '../components/PermissionGate'
import {
  Scale, ExternalLink, Landmark, FileText, ListChecks, Gavel,
  Building, ShieldCheck, AlertTriangle, ArrowDown
} from 'lucide-react'

const Legal = () => {
  const { t, isRTL, language, hasPermission , pickName} = useApp()
  const [expanded, setExpanded] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')

  if (!hasPermission('legal.view')) return <NoPermission />

  const categories = [
    { id: 'all', label: t('all'), icon: Scale },
    { id: 'law', label: language === 'ar' ? 'القوانين' : language === 'fr' ? 'Lois' : 'Laws', icon: Gavel },
    { id: 'decree', label: language === 'ar' ? 'المراسيم والقرارات' : language === 'fr' ? 'Décrets et arrêtés' : 'Decrees & Orders', icon: FileText },
    { id: 'list', label: language === 'ar' ? 'اللوائح الرسمية' : language === 'fr' ? 'Listes officielles' : 'Official Lists', icon: ListChecks },
  ]

  const filtered = categoryFilter === 'all'
    ? legalReferences
    : legalReferences.filter(r => r.category === categoryFilter)

  const categoryColors = {
    law: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    decree: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    list: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  }

  const categoryLabels = {
    law: language === 'ar' ? 'قانون' : language === 'fr' ? 'Loi' : 'Law',
    decree: language === 'ar' ? 'مرسوم / قرار' : language === 'fr' ? 'Décret / Arrêté' : 'Decree / Order',
    list: language === 'ar' ? 'لائحة رسمية' : language === 'fr' ? 'Liste officielle' : 'Official List',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Scale className="w-7 h-7 text-primary-600" />
          {t('legalTitle')}
        </h1>
        <p className="text-sm text-gray-600 mt-1">{t('legalSubtitle')}</p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => {
          const Icon = cat.icon
          const active = categoryFilter === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                active ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* References list */}
      <div className="space-y-4">
        {filtered.map((ref) => {
          const color = categoryColors[ref.category]
          const isOpen = expanded === ref.id
          return (
            <article key={ref.id} className={`card overflow-hidden ${isOpen ? 'ring-1 ring-primary-300' : ''}`}>
              <button
                onClick={() => setExpanded(isOpen ? null : ref.id)}
                className="w-full text-start p-4 lg:p-5 flex items-start gap-3 hover:bg-gray-50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl ${color.bg} ${color.text} flex items-center justify-center shrink-0`}>
                  {ref.category === 'law' ? <Gavel className="w-5 h-5" /> : ref.category === 'decree' ? <FileText className="w-5 h-5" /> : <ListChecks className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color.bg} ${color.text} border ${color.border}`}>
                      {categoryLabels[ref.category]}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm lg:text-base leading-snug">
                    {isRTL ? ref.titleAr : ref.titleEn}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {isRTL ? ref.referenceAr : ref.referenceEn}
                  </p>
                </div>
                <ArrowDown className={`w-5 h-5 text-gray-400 shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="px-4 lg:px-5 pb-5 pt-0 space-y-4 border-t border-gray-100">
                  {/* Authority */}
                  <div className="flex items-start gap-2 pt-4">
                    <Building className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-500">{t('legalSource')}</p>
                      <p className="text-sm text-gray-900">{isRTL ? ref.authorityAr : ref.authorityEn}</p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-500">{t('legalSummary')}</p>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {isRTL ? ref.summaryAr : ref.summaryEn}
                      </p>
                    </div>
                  </div>

                  {/* Platform impact */}
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-primary-50 border border-primary-100">
                    <ShieldCheck className="w-4 h-4 text-primary-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-primary-700">{t('legalImplication')}</p>
                      <p className="text-sm text-primary-900 leading-relaxed">
                        {isRTL ? ref.impactAr : ref.impactEn}
                      </p>
                    </div>
                  </div>

                  {/* Source link */}
                  <a
                    href={ref.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 underline underline-offset-4"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t('legalOpenSource')} — {ref.sourceLabel}
                  </a>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {/* Official authorities */}
      <div className="card p-4 lg:p-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Landmark className="w-5 h-5 text-primary-600" />
          {isRTL ? 'الجهات الرسمية المختصة' : 'Official Competent Authorities'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {officialAuthorities.map((auth) => (
            <a
              key={auth.nameEn}
              href={auth.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all group"
            >
              <p className="font-semibold text-sm text-gray-900 group-hover:text-primary-700 mb-1">
                {isRTL ? auth.nameAr : auth.nameEn}
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {auth.descAr}
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-primary-600 mt-2">
                <ExternalLink className="w-3 h-3" />
                {auth.url.replace('https://', '')}
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Legal note */}
      <div className="p-4 lg:p-5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-900 text-sm">{t('legalNote')}</p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            {t('legalNoteText')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Legal
