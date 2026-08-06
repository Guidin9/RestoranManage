// src/motion.js'in saf matematiği: momentum projeksiyonu, snap seçimi,
// rubber-band ve elle entegre edilen yay. Jestin hissi bunlara bağlı ve
// tarayıcıda gözle doğrulaması zor, o yüzden deterministik test edilirler.
//
// Çalıştır:  npm run test:motion
import { project, nearest, rubberband, springTo, springSheet, springDefault } from '../src/motion.js';

let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'OK  ' : 'HATA'}  ${name}${extra ? '  → ' + extra : ''}`);
  if (!ok) failed++;
};

// --- project: Apple'ın üstel sönüm formu, v²/(2a) DEĞİL --------------------
check('project(1000) ≈ 499px', Math.abs(project(1000) - 499) < 1, project(1000).toFixed(1));
check('project işareti hızı izler', project(-500) < 0 && project(500) > 0);
check('project(0) = 0', project(0) === 0);

// --- nearest: bırakma noktasına değil, PROJEKSİYONA en yakın snap ----------
check('nearest(18,[0,79]) = 0', nearest(18, [0, 79]) === 0);
check('nearest(60,[0,79]) = 79', nearest(60, [0, 79]) === 79);
check('nearest(60,[0,104,200]) = 104 (orta snap atlanmaz)', nearest(60, [0, 104, 200]) === 104);

// --- rubberband: kademeli direnç, sert duvar değil -------------------------
const r10 = rubberband(10, 300), r100 = rubberband(100, 300), r1000 = rubberband(1000, 300);
check('rubberband monoton artar', r10 < r100 && r100 < r1000,
  `${r10.toFixed(1)} < ${r100.toFixed(1)} < ${r1000.toFixed(1)}`);
check('rubberband girdiden hep küçük (direnç var)', r100 < 100 && r1000 < 1000);
check('rubberband büyük aşımda doyar', r1000 < 300, r1000.toFixed(1));

// --- springTo: rAF + performance shim'iyle sabit adımlı simülasyon ---------
function runSpring(from, target, opts) {
  let now = 0;
  const queue = [];
  globalThis.performance = { now: () => now };
  globalThis.requestAnimationFrame = (cb) => queue.push(cb);
  globalThis.cancelAnimationFrame = () => {};

  let current = from;
  const trace = [];
  const value = { get: () => current, set: (v) => { current = v; trace.push(v); } };

  springTo(value, target, opts);
  for (let i = 0; i < 600 && queue.length; i++) {   // 600 kare ≈ 10 sn
    now += 1000 / 60;
    queue.shift()(now);
  }
  return { son: current, iz: trace };
}

const critical = runSpring(0, 100, { response: springDefault.visualDuration, bounce: 0 });
check('yay (bounce 0) hedefe oturur', Math.abs(critical.son - 100) < 0.01, critical.son.toFixed(3));
check('yay (bounce 0) taşma YAPMAZ', Math.max(...critical.iz) <= 100.001,
  'tepe=' + Math.max(...critical.iz).toFixed(2));

const bouncy = runSpring(0, 100, { response: springSheet.visualDuration, bounce: springSheet.bounce });
check('yay (bounce .2) hedefe oturur', Math.abs(bouncy.son - 100) < 0.01, bouncy.son.toFixed(3));
check('yay (bounce .2) taşma YAPAR', Math.max(...bouncy.iz) > 100.5,
  'tepe=' + Math.max(...bouncy.iz).toFixed(2));

// Hız devri: sürükleme ile animasyon arasında dikiş kalmamalı
const handoff = runSpring(79, 0, { response: 0.3, bounce: 0.2, velocity: -600 });
check('hız devri: ilk kare bırakma yönünde', handoff.iz[0] < 79, handoff.iz[0].toFixed(1));
check('hız devri: yine de hedefte biter', Math.abs(handoff.son) < 0.01, handoff.son.toFixed(3));

// Hedefin tersine bırakılan fiske önce kendi yönüne taşımalı
const against = runSpring(40, 79, { response: 0.3, bounce: 0.2, velocity: -800 });
check('ters hız önce kendi yönüne taşır', Math.min(...against.iz) < 40,
  'dip=' + Math.min(...against.iz).toFixed(1));
check('sonra hedefe döner', Math.abs(against.son - 79) < 0.01, against.son.toFixed(3));

// Hız sınırındaki (5000 px/s) kararlılık
const extreme = runSpring(50, 0, { response: 0.3, bounce: 0.2, velocity: -5000 });
check('uç hızda bile sonlu ve hedefte',
  Number.isFinite(extreme.son) && Math.abs(extreme.son) < 0.01, extreme.son.toFixed(3));

console.log(failed ? `\n${failed} kontrol BAŞARISIZ` : '\nTüm kontroller geçti');
process.exit(failed ? 1 : 0);
