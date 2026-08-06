import { createContext, useContext } from 'react';

/* Context ve hook bilerek bileşenlerden ayrı bir dosyada: oxlint'in
   react/only-export-components kuralı bir dosyanın hem bileşen hem
   bileşen-olmayan export etmesinden şikâyet ediyor. */

export const ToastContext = createContext(null);

/**
 * Bildirim göstermek için: const toast = useToast();
 *   toast.error('Sunucuya bağlanılamadı.')
 *   toast.ok('Sipariş alındı')  ·  toast.warn(...)  ·  toast.status(...)
 *
 * window.alert() yerine bunu kullan: alert tüm sayfayı bloklar, sayfanın
 * dilinde/temasında değildir ve dokunmatikte kullanıcıyı akıştan koparır.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast, <ToastProvider> içinde kullanılmalı.');
  return context;
}
