// =====================================================================
// أدوات التصدير — CSV بترميز UTF-8 مع BOM
// الـBOM إلزامي كي تُعرض العربية/الفرنسية بشكل سليم عند فتح الملف
// في Excel وLibreOffice (بدونه يظهر ������).
// filename: اسم الملف بلا امتداد — يُلحق به التاريخ والامتداد تلقائياً.
// rows: مصفوفة صفوف؛ الصف الأول ترويسة الأعمدة.
// =====================================================================

const escapeCell = (value) => {
  const s = String(value ?? '')
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const exportToCSV = (filename, rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return false
  const csv = '\uFEFF' + rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `${filename}-${date}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
  return true
}

// تنسيق الأرقام النقدية بشكل دقيق وموحد في كل التقارير (خانتان عشريتان)
export const money = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
