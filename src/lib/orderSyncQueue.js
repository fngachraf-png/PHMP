// =====================================================================
// PHMP — طابور إعادة مزامنة الطلبات الفاشلة (إنشاء/تحديث) — ذاكرة فقط
// ---------------------------------------------------------------------
// عند فشل حفظ الطلب (POST /api/orders) أو تحديث حالته (PATCH) أثناء
// انقطاع الخادم يبقى الطلب سليماً محلياً (localStorage) ويُصفّف هنا، ثم
// يُعاد إرساله تلقائياً عند عودة الاتصال الفوري أو دورياً (كل 60 ثانية).
// الطلب وحده معنيّ بالتخزين المركزي؛ الرسائل والمكالمات لا تدخل هذا
// الطابور إطلاقاً (قاعدة المالك: تُستهلك مباشرة ولا تُخزَّن).
// وحدة مستقلة بلا تبعيات كي تُختبر منطقياً بمعزل عن React.
// =====================================================================

const queue = new Map() // orderId -> { orderId, kind: 'create'|'update', payload, ts }

export const orderSyncQueue = {
  // إضافة/تحديث عنصر (المفتاح معرف الطلب — التحديث الأحدث يستبدل الأقدم)
  add({ orderId, kind = 'create', payload }) {
    if (!orderId || !payload) return
    queue.set(orderId, { orderId, kind, payload, ts: Date.now() })
  },

  remove(orderId) { queue.delete(orderId) },

  size() { return queue.size },

  clear() { queue.clear() },

  entries() { return [...queue.values()] },

  // تصريف الطابور: يُعيد عدد العناصر التي نجحت. يتوقف عند أول فشل
  // (الخادم ما زال متعثراً) فتبقى بقية العناصر للمحاولة التالية.
  // calls: { create(order), update(orderId, updates) } — دوال إرسال حقيقية.
  // onSuccess(entry) لكل عنصر ناجح، وonError(entry, err) للفاشل.
  async flush(calls, onSuccess, onError) {
    let okCount = 0
    for (const entry of [...queue.values()]) {
      try {
        if (entry.kind === 'update') await calls.update(entry.orderId, entry.payload)
        else await calls.create(entry.payload)
        queue.delete(entry.orderId)
        okCount += 1
        try { onSuccess?.(entry) } catch { /* ردّ مستمع معطل */ }
      } catch (err) {
        try { onError?.(entry, err) } catch { /* تجاهل */ }
        break
      }
    }
    return okCount
  },
}

export default orderSyncQueue
