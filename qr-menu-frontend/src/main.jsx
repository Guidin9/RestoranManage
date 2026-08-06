import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './Toast.jsx'

// reducedMotion="user" ŞART: index.css'teki !important reduced-motion
// kill-switch'i yalnızca CSS animasyonlarını durdurur, JS sürücülü
// (requestAnimationFrame) Motion animasyonlarına DOKUNAMAZ. Bu satır
// olmadan uygulama "Hareketi Azalt" ayarını sessizce yok sayar.
// LazyMotion + domMax: bu paket müşteri QR rotasına iniyor ve rastgele
// telefonlar onu mobil veriyle indiriyor, o yüzden özellik seti dar tutuldu.
// domMax'in getirdiği drag ve layout'a ihtiyacımız yok: sürükleme jesti
// useDragSheet'te ham Pointer Events ile yazılı, ki zaten kesintiye
// uğratılabilirlik için gereken kontrol de o. strict, motion.* kullanımını
// hataya çevirir — ölçüyü kaza eseri geri büyütmeyelim diye.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <App />
        </ToastProvider>
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
)
