/* =========================================================================
   Hareket sistemi — Apple'ın "Designing Fluid Interfaces" yaklaşımının
   Motion (motion/react) karşılıkları.

   Apple iki tasarımcı-dostu parametre kullanır:
     - damping ratio → ne kadar taşacağı (1.0 = hiç taşmaz)
     - response      → hedefe ne kadar hızlı varacağı (saniye)
   Motion karşılığı:
     - bounce = 1 − dampingRatio
     - visualDuration = response   ← duration DEĞİL!
       duration tam oturma süresini, visualDuration hedefe ilk varış
       süresini ölçer; Apple'ın "response"u tam olarak ikincisidir.

   EV KURALI: varsayılan bounce: 0. bounce > 0 yalnızca animasyona gerçek
   bir jest momentum taşıdıysa (fiske, fırlatma, sürükleyip bırakma).
   Sadece beliriveren bir modalın taşması yanlış hisssettirir.
   ========================================================================= */

/* Apple'ın "response" değerleri — elle entegre ettiğimiz springTo bunları
   kullanır (ω₀ = 2π / response). */
export const RESPONSE = { snappy: 0.3, default: 0.4, sheet: 0.3, momentum: 0.4 };

/* Motion bileşen geçişleri. `duration` DEĞİL `visualDuration`: duration tam
   oturma süresini, visualDuration hedefe ilk varış süresini ölçer — Apple'ın
   "response"u tam olarak ikincisidir. */

/** Basma geri bildirimi, küçük kabuk hareketi. Apple: damping 1.0 / response 0.3 */
export const springSnappy = { type: 'spring', visualDuration: RESPONSE.snappy, bounce: 0 };

/** Modal/kart girişi, yeniden konumlama. Apple: damping 1.0 / response 0.4 */
export const springDefault = { type: 'spring', visualDuration: RESPONSE.default, bounce: 0 };

/** Sürüklemeden SONRA sepet snap'i. Apple: damping 0.8 / response 0.3 */
export const springSheet = { type: 'spring', visualDuration: RESPONSE.sheet, bounce: 0.2 };

/** Fiskeyle fırlatılan öğeler. Apple: damping 0.8 / response 0.4 */
export const springMomentum = { type: 'spring', visualDuration: RESPONSE.momentum, bounce: 0.2 };

/** Çıkışlar yayla değil, kısa bir eğriyle: --ease-out'un JS ikizi */
export const fadeOut = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };

/** Kaydırma yavaşlama katsayısı — 0.998 normal, 0.99 daha çabuk duran */
export const DECEL = 0.998;

/**
 * Momentum projeksiyonu: bırakma hızıyla nereye VARILACAĞINI hesaplar.
 * Fizik kitabındaki v²/(2a) değil — Apple'ın gerçekte kullandığı
 * üstel sönüm formu bu. Fiskenin "fırlatma" hissi buradan gelir:
 * en yakın noktaya değil, gidilen yere snaplenir.
 */
export const project = (velocity, decel = DECEL) =>
  ((velocity / 1000) * decel) / (1 - decel);

/**
 * Sınırda kademeli direnç. Sert duruş "donmuş" okunur; süregelen direnç
 * "cevap veriyor ama burada daha fazlası yok" okunur.
 */
export const rubberband = (overshoot, dimension, constant = 0.55) =>
  (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));

/** Bir listedeki değere en yakın olanı döndürür */
export const nearest = (value, points) =>
  points.reduce((best, p) => (Math.abs(p - value) < Math.abs(best - value) ? p : best), points[0]);

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const FIXED_STEP = 1 / 240;  // s — sabit alt adım, sayısal kararlılık için
const MAX_FRAME = 0.064;     // s — sekmeye geri dönüşte dev adım atmasın

/**
 * Bir MotionValue'yu yayla hedefe taşır.
 *
 * Neden Motion'ın animate()'i değil: bu kurulumda animate() bir MotionValue'yu
 * hiç sürmüyor — animasyon nesnesi "running" görünüyor ama tek bir kare bile
 * üretmiyor, onUpdate dahi çağrılmıyor. Bileşen üstündeki transition'lar
 * (Modal, Toast, sepet girişi) sorunsuz çalışıyor; sorun yalnızca imperative
 * yolda. Jestin can damarı da tam orası olduğu için yay burada elle entegre
 * ediliyor: yarı-örtük Euler, sabit alt adım.
 *
 * Apple'ın iki parametresi doğrudan kullanılır:
 *   response → doğal frekans  ω₀ = 2π / response
 *   bounce   → sönüm oranı    ζ  = 1 − bounce   (0 = hiç taşmaz)
 *
 * velocity (px/s) başlangıç hızıdır: sürüklemeden animasyona dikişsiz geçişi
 * sağlayan şey budur. stop() ile her an kesilebilir; çağıran taraf o anda
 * value.get() ile CANLI değeri okuyup oradan devam eder.
 */
export function springTo(value, target, { response = 0.4, bounce = 0, velocity = 0, onComplete } = {}) {
  const omega = (2 * Math.PI) / Math.max(0.05, response);
  const zeta = clamp(1 - bounce, 0.05, 4);

  let x = value.get();
  let v = Number.isFinite(velocity) ? velocity : 0;
  let last = performance.now();
  let frame = 0;
  let stopped = false;

  const step = (now) => {
    if (stopped) return;
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    const steps = Math.max(1, Math.ceil(elapsed / FIXED_STEP));
    const h = elapsed / steps;
    for (let i = 0; i < steps; i++) {
      const acceleration = -(omega * omega) * (x - target) - 2 * zeta * omega * v;
      v += acceleration * h;
      x += v * h;
    }

    if (Math.abs(x - target) < 0.05 && Math.abs(v) < 1) {
      stopped = true;
      value.set(target);
      onComplete?.();
      return;
    }
    value.set(x);
    frame = requestAnimationFrame(step);
  };

  frame = requestAnimationFrame(step);
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
    },
  };
}
