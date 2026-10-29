// أدوات معالجة الصور — ضغط الصور في المتصفح قبل التخزين المحلي
// تُستعمل لصور وثيقة الهوية والوصفة الطبية في واجهة الزبون

export const compressImage = (file, maxDim = 1024, quality = 0.72) =>
  new Promise((resolve, reject) => {
    if (!file) return reject(new Error('no-file'))
    if (!file.type.startsWith('image/')) return reject(new Error('not-image'))

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read-error'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('image-error'))
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff' // خلفية بيضاء للصور الشفافة
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })

// التحقق من وضوح الصورة (حد أدنى للأبعاد حتى تكون "صورة واضحة")
export const isClearEnough = (base64, minDim = 480) =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(Math.min(img.width, img.height) >= minDim)
    img.onerror = () => resolve(false)
    img.src = base64
  })
