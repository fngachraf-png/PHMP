// =====================================================================
// PHMP — نغمات التنبيه الصوتية (WebAudio — بلا ملفات خارجية)
// ---------------------------------------------------------------------
// نغمة رسالة واردة + رنة مكالمة واردة (حلقة) + نغمة إنهاء + اهتزاز.
// تُولَّد برمجياً بمذبذبات WebAudio فتعمل دون اتصال ودون أصول، وتُفتح
// القناة الصوتية عند أول تفاعل من المستخدم (سياسة التشغيل التلقائي).
// =====================================================================

let ctx = null
let unlocked = false
let ringNodes = null

const ensureCtx = () => {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// فتح القناة عند أول إيماءة (إلا وإلا حجب المتصفح الصوت حتى التفاعل)
if (typeof window !== 'undefined') {
  const unlock = () => { unlocked = true; ensureCtx() }
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
  window.addEventListener('keydown', unlock, { once: true, capture: true })
}

// نغمة قصيرة: ترددات متتابعة بجدول زمني
const playSequence = (notes, volume = 0.18, type = 'sine') => {
  const ac = ensureCtx()
  if (!ac) return
  const now = ac.currentTime
  notes.forEach(({ freq, at, dur }) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now + at)
    gain.gain.setValueAtTime(0, now + at)
    gain.gain.linearRampToValueAtTime(volume, now + at + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur)
    osc.connect(gain).connect(ac.destination)
    osc.start(now + at)
    osc.stop(now + at + dur + 0.05)
  })
}

export const sounds = {
  // ✓ نغمة رسالة جديدة (دينغ لطيف مزدوج)
  message() {
    playSequence([
      { freq: 880, at: 0, dur: 0.12 },
      { freq: 1318.5, at: 0.11, dur: 0.16 },
    ])
    this.vibrate([80, 40, 80])
  },

  // ✓ رنة مكالمة واردة (حلقة كلاسيكية: دويان × 2 ثم سكون — تتكرر)
  ringStart() {
    if (ringNodes) return
    const ac = ensureCtx()
    if (!ac) return
    ringNodes = { timer: null, stopped: false }
    const burst = () => {
      if (!ringNodes || ringNodes.stopped) return
      playSequence([
        { freq: 784, at: 0, dur: 0.35, },
        { freq: 988, at: 0.45, dur: 0.35 },
      ], 0.22, 'sine')
      this.vibrate([300, 150, 300])
    }
    burst()
    ringNodes.timer = setInterval(burst, 2200)
  },

  ringStop() {
    if (ringNodes) {
      ringNodes.stopped = true
      if (ringNodes.timer) clearInterval(ringNodes.timer)
      ringNodes = null
    }
  },

  // ✓ نغمة الاتصال قيد الانتظار (تُسمع للمتصل أثناء الرنين)
  ringback() {
    playSequence([
      { freq: 440, at: 0, dur: 0.8 },
      { freq: 440, at: 1.6, dur: 0.8 },
    ], 0.08, 'sine')
  },

  // ✓ نغمة إنهاء المكالمة
  callEnd() {
    playSequence([
      { freq: 587, at: 0, dur: 0.12 },
      { freq: 440, at: 0.14, dur: 0.2 },
    ], 0.15)
  },

  // ✓ طلب انضمام (نغمة صاعدة عند بدء مكالمة صادرة)
  outgoing() {
    playSequence([
      { freq: 523, at: 0, dur: 0.1 },
      { freq: 659, at: 0.1, dur: 0.1 },
      { freq: 784, at: 0.2, dur: 0.14 },
    ], 0.14)
  },

  // ✓ اهتزاز الجهاز (إن كان مدعوماً — الهاتف)
  vibrate(pattern = [120]) {
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern) } catch { /* غير مدعوم */ }
  },
}

export default sounds
