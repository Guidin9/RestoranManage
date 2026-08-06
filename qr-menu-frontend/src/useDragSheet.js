import { useCallback, useRef, useState } from 'react';
import { useMotionValue, useReducedMotion } from 'motion/react';
import { clamp, nearest, project, RESPONSE, rubberband, springSheet, springTo } from './motion';

/* =========================================================================
   Kesintiye uğratılabilir sürükleme jesti.

   Apple'ın akıcılık ilkelerinin hepsi burada toplanıyor:
   - Pointer Events + setPointerCapture: parmak elemanın dışına çıksa da
     takip kopmaz.
   - Yakalama noktası korunur (grab offset): elemana nereden bastıysan
     oradan tutulur, merkeze zıplamaz.
   - 10px histerezis: bu eşiğin altı hâlâ bir "tap"tır.
   - Hız halka tamponu: bırakış anındaki hız son örneklerden hesaplanır.
     Motion'ın useVelocity'si kısayol ama frame-kuantize ve bırakışta
     gürültülü; Apple'ın örnek kodu da halka tamponu kullanır.
   - Sınırda rubber-band: sert duvar yok, kademeli direnç var.
   - Momentum projeksiyonu: bırakma noktasına DEĞİL, jestin gittiği yere
     snaplenir.
   - Hız devri: yay, parmağın tam bırakma hızıyla devam eder — sürükleme
     ile animasyon arasında dikiş kalmaz.
   - Kesinti: uçuş hâlindeki animasyon durdurulup CANLI sunum değerinden
     devam edilir; yeniden yakalamada ne sıçrama ne hız duvarı olur.
   ========================================================================= */

const HYSTERESIS = 10;      // px — bunun altı tap sayılır
const SAMPLE_WINDOW = 100;  // ms — hız bu pencereden hesaplanır
const MAX_SAMPLES = 5;
const MIN_SAMPLE_DT = 4;    // ms — bundan kısa aralıkta hız ölçülmez
const MAX_VELOCITY = 5000;  // px/s — gerçek bir parmağın üst sınırı

/**
 * @param {number}   initial        başlangıç değeri (px)
 * @param {Function} getSnapPoints  () => number[] — ölçüm gerektirebildiği için fonksiyon
 * @param {number}   direction      +1: aşağı sürükleme değeri artırır, -1: azaltır
 * @param {object}   spring         bırakış yayı (varsayılan springSheet)
 * @param {Function} onSnap         (target) => void, hedef seçildiğinde
 * @param {Function} onTap          eşik aşılmadan bırakıldığında
 */
export function useDragSheet({
  initial,
  getSnapPoints,
  direction = -1,
  response = RESPONSE.sheet,
  bounce = springSheet.bounce,
  onSnap,
  onTap,
}) {
  const value = useMotionValue(initial);
  const reduceMotion = useReducedMotion();
  const [isDragging, setIsDragging] = useState(false);

  const st = useRef({
    pointerId: null,
    startPointer: 0,
    startValue: 0,
    engaged: false,
    samples: [],
    controls: null,
    snaps: [],
  });

  /** Hedefe yerleş. Azaltılmış harekette taşma yok — doğrudan manipülasyonun
      kendisi vestibüler değil, o kalır; giden şey taşan yay. */
  const settle = useCallback(
    (target, velocity = 0) => {
      st.current.controls?.stop();
      st.current.controls = springTo(value, target, {
        response: reduceMotion ? 0.2 : response,
        bounce: reduceMotion ? 0 : bounce,
        velocity,
      });
      onSnap?.(target);
    },
    [reduceMotion, response, bounce, value, onSnap],
  );

  const snapTo = useCallback((target) => settle(target, 0), [settle]);

  const handlePointerDown = useCallback(
    (event) => {
      if (st.current.pointerId !== null) return;

      // Uçuş hâlindeki animasyonu durdur ve CANLI değerden devam et.
      // Hedef değerden başlamak görünür bir sıçrama yaratırdı.
      st.current.controls?.stop();
      st.current.controls = null;

      const s = st.current;
      s.pointerId = event.pointerId;
      s.startPointer = event.clientY;
      s.startValue = value.get();
      s.engaged = false;
      s.samples = [{ t: performance.now(), v: s.startValue }];
      s.snaps = getSnapPoints();

      // Yakalama başarısız olsa da jest çalışmalı: Safari, pointer o an
      // aktif değilse burada atıyor.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch { /* yakalama yoksa normal olay akışıyla devam */ }
    },
    [getSnapPoints, value],
  );

  const handlePointerMove = useCallback(
    (event) => {
      const s = st.current;
      if (s.pointerId !== event.pointerId) return;

      const pointerDelta = event.clientY - s.startPointer;

      if (!s.engaged) {
        if (Math.abs(pointerDelta) < HYSTERESIS) return;
        // Eşiği düşerek başla, yoksa jest 10px'lik bir sıçramayla açılır
        s.startPointer += Math.sign(pointerDelta) * HYSTERESIS;
        s.engaged = true;
        setIsDragging(true);
      }

      const raw = s.startValue + direction * (event.clientY - s.startPointer);
      const min = Math.min(...s.snaps);
      const max = Math.max(...s.snaps);
      const span = Math.max(120, max - min);

      let next = raw;
      if (raw > max) next = max + rubberband(raw - max, span);
      else if (raw < min) next = min - rubberband(min - raw, span);

      value.set(next);

      const now = performance.now();
      s.samples.push({ t: now, v: next });
      while (s.samples.length > MAX_SAMPLES || (s.samples.length > 2 && now - s.samples[0].t > SAMPLE_WINDOW)) {
        s.samples.shift();
      }
    },
    [direction, value],
  );

  const endGesture = useCallback(
    (event) => {
      const s = st.current;
      // Devam eden bir jest yoksa yapacak bir şey yok. Kimlik uyuşmazlığında
      // yine de bitiriyoruz: iptal/yakalama kaybı olaylarında pointerId
      // güvenilmez olabiliyor ve jest yarım kalırsa yükseklik snap noktası
      // olmayan bir yerde asılı kalır.
      if (s.pointerId === null) return;
      s.pointerId = null;

      const node = event.currentTarget;
      if (node?.hasPointerCapture?.(event.pointerId)) {
        node.releasePointerCapture(event.pointerId);
      }

      if (!s.engaged) {
        onTap?.();
        return;
      }
      setIsDragging(false);

      // Hız: değer birimi / saniye (px/s), halka tamponundan.
      // dt tabanı ve MAX_VELOCITY sınırı şart: iki olay birkaç yüz mikrosaniye
      // arayla gelirse hız on binlere fırlıyor, projeksiyon ve yay saçmalıyor
      // (yay hedefe hiç varmıyor, değer bırakıldığı yerde kalıyor).
      const first = s.samples[0];
      const last = s.samples[s.samples.length - 1];
      const dt = last.t - first.t;
      const raw = dt >= MIN_SAMPLE_DT ? ((last.v - first.v) / dt) * 1000 : 0;
      const velocity = Number.isFinite(raw) ? clamp(raw, -MAX_VELOCITY, MAX_VELOCITY) : 0;

      const min = Math.min(...s.snaps);
      const max = Math.max(...s.snaps);
      // Nereye VARILACAĞI — bırakıldığı yer değil. Fırlatma hissi burada.
      const projected = clamp(value.get() + project(velocity), min, max);

      settle(nearest(projected, s.snaps), velocity);
    },
    [onTap, settle, value],
  );

  const bind = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: endGesture,
    onPointerCancel: endGesture,
    // Yakalama kaybı da bir bitiştir: olmadığında (ör. tarayıcı jesti devralır)
    // pointerup hiç gelmez ve sheet parmağın bıraktığı yerde kalır.
    onLostPointerCapture: endGesture,
  };

  return { value, bind, snapTo, isDragging };
}
