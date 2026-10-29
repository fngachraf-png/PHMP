// =====================================================================
// ثيم الرسوم المبيانية (recharts) — ألوان تتكيف مع الوضع الفاتح/الداكن
// مشترك بين صفحة التقارير ولوحة التحكم لضمان تناسق واحد.
// =====================================================================

export const getChartTheme = (theme) => {
  const dark = theme === 'dark'
  return {
    axisColor: dark ? '#94a3b8' : '#4b5563',      // نص المحاور (تباين عالٍ)
    gridColor: dark ? '#334155' : '#e5e7eb',      // خطوط الشبكة
    tooltipStyle: {
      backgroundColor: dark ? '#1e293b' : '#ffffff',
      border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`,
      borderRadius: '10px',
      fontSize: '12px',
      color: dark ? '#f1f5f9' : '#111827',
      boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
    },
    tooltipItemStyle: { color: dark ? '#e2e8f0' : '#374151' },
    // ألوان السلاسل (تعمل في الوضعين)
    series: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'],
  }
}

// اختصار الأرقام الكبيرة على محاور الرسوم: 12500 → 12.5k
export const compactNumber = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return String(Math.round(v))
}
