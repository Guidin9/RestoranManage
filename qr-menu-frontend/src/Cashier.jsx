import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { apiFetch, getToken, setToken, clearToken, UnauthorizedError } from './api';
import { IconCard, IconLogout, IconLogin, IconCloche, IconBell, IconCheck } from './icons';
import { ICON } from './iconScale';
import { useToast } from './useToast';
import { useScrolled } from './useScrolled';
import { Modal } from './Modal';
import { fadeOut, springDefault } from './motion';
import CashierSummary from './CashierSummary';

function Cashier() {
    const toast = useToast();
    // Oturum, kasa token'ının varlığına bağlı.
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken('cashier'));

    // Form State'leri
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Kasa Verileri. loading true BAŞLIYOR: ilk fetch dönene kadar "açık
    // masanız yok" yazmak yanlıştı — veri yokken boş durum gösteriliyordu.
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Görünüm: açık hesaplar mı, gün özeti dashboard mu?
    const [view, setView] = useState('orders');

    const { scrolled, navRef, sentinelRef } = useScrolled(view);

    // Hesap kapatma onayı bekleyen sipariş (modal)
    const [closingOrder, setClosingOrder] = useState(null);

    // Dashboard'un yetki hatasında oturumu düşürmesi için sabit referans
    const handleSummaryAuthError = useCallback(() => setIsAuthenticated(false), []);

    // 1. MANTIK: Giriş Yapma İşlemi
    const handleLogin = (e) => {
        e.preventDefault();
        setLoginError('');

        apiFetch('/api/cashier/login', { method: 'POST', body: { username, password } })
            .then(res => {
                if (res.success && res.token) {
                    setToken('cashier', res.token);
                    setIsAuthenticated(true);
                    setPassword('');
                } else {
                    setLoginError(res.message || 'Giriş başarısız!');
                }
            })
            .catch(() => setLoginError('Sunucuya bağlanılamadı.'));
    };

    // 2. MANTIK: Çıkış Yapma İşlemi (token'ı sunucuda da iptal ediyoruz)
    const handleLogout = () => {
        apiFetch('/api/logout', { role: 'cashier', method: 'POST' })
            .catch(() => { /* token zaten geçersizse sorun değil */ })
            .finally(() => {
                clearToken('cashier');
                setIsAuthenticated(false);
            });
    };

    // 3. MANTIK: Aktif Siparişleri Çekme
    const fetchActiveOrders = () => {
        apiFetch('/api/cashier/orders', { role: 'cashier' })
            .then(res => {
                if (res.success) {
                    setOrders(res.data);
                }
                setLoading(false);
            })
            .catch(err => {
                if (err instanceof UnauthorizedError) {
                    setIsAuthenticated(false);
                    return;
                }
                console.error("Kasa verisi çekilemedi:", err);
            });
    };

    useEffect(() => {
        if (!isAuthenticated || view !== 'orders') return;

        fetchActiveOrders();
        const interval = setInterval(() => {
            fetchActiveOrders();
        }, 5000);

        return () => clearInterval(interval);
    }, [isAuthenticated, view]);

    const handlePayOrder = (orderId) => {
        apiFetch(`/api/cashier/orders/${orderId}/pay`, { role: 'cashier', method: 'POST' })
            .then(res => {
                if (res.success) {
                    setOrders(prev => prev.filter(order => order.id !== orderId));
                    setClosingOrder(null);
                }
            })
            .catch(err => {
                if (err instanceof UnauthorizedError) {
                    setIsAuthenticated(false);
                    return;
                }
                toast.error("Hesap kapatılamadı, sunucuya ulaşılamıyor.");
            });
    };

    const calculateOrderTotal = (items) => {
        return items.reduce((total, item) => total + (item.price_at_sale * item.quantity), 0).toFixed(2);
    };

    // Servis bekleyen (mutfak hazırladı) kalem sayısı — kart vurgusu / banner / buton için
    const orderReadyCount = (items) => items.reduce((n, i) => n + (i.ready_quantity || 0), 0);
    const readyOrderCount = orders.filter(o => orderReadyCount(o.items) > 0).length;

    // Servis işaretleme — mutfağın hazırladığı (ready) kalemleri servis et
    const handleServeItem = (itemId) => {
        apiFetch(`/api/cashier/items/${itemId}/serve`, { role: 'cashier', method: 'POST' })
            .then(res => {
                if (res.success) fetchActiveOrders();
            })
            .catch(err => {
                if (err instanceof UnauthorizedError) { setIsAuthenticated(false); return; }
                toast.error("Servis işaretlenemedi, sunucuya ulaşılamıyor.");
            });
    };

    const handleServeAll = (orderId) => {
        apiFetch(`/api/cashier/orders/${orderId}/serve`, { role: 'cashier', method: 'POST' })
            .then(res => {
                if (res.success) fetchActiveOrders();
            })
            .catch(err => {
                if (err instanceof UnauthorizedError) { setIsAuthenticated(false); return; }
                toast.error("Servis işaretlenemedi, sunucuya ulaşılamıyor.");
            });
    };

    // 🔴 EĞER GİRİŞ YAPILMADIYSA: GİRİŞ EKRANINI GÖSTER
    if (!isAuthenticated) {
        return (
            <div className="login-wrap">
                <form onSubmit={handleLogin} className="login-card">
                    <div className="login-head">
                        <div className="login-arch">K</div>
                        <h2>Kasiyer Girişi</h2>
                        <p className="login-sub">Açık hesapları görmek için giriş yapın</p>
                    </div>
                    <div className="login-body">
                        {loginError && <div className="alert">{loginError}</div>}
                        <div className="field">
                            <label className="label">Kullanıcı Adı</label>
                            <input
                                type="text"
                                className="input"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                placeholder="kullanıcı adınız"
                            />
                        </div>
                        <div className="field" style={{ marginBottom: 20 }}>
                            <label className="label">Şifre</label>
                            <input
                                type="password"
                                className="input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                            />
                        </div>
                        <button type="submit" className="btn btn-success btn-block">Giriş Yap<IconLogin /></button>
                    </div>
                </form>
            </div>
        );
    }

    // 🟢 EĞER GİRİŞ YAPILDIYSA: KASA PANELİNİ GÖSTER
    return (
        <div className="page">
            <div ref={navRef} className={`app-nav${scrolled ? ' is-collapsed' : ''}`}>

                <div className="app-nav-row">
                    <div className="app-nav-main">
                        <div className="app-nav-title">Kasa</div>
                        <div className="app-nav-sub">Açık hesaplar canlı izleniyor</div>
                    </div>
                    <div className="app-nav-actions">
                        {view === 'orders' && <span className="badge-live"><span className="dot-live" />Canlı</span>}
                        <button onClick={handleLogout} className="btn btn-logout btn-sm"><IconLogout size={ICON.xs} />Çıkış</button>
                    </div>
                </div>

                {/* GÖRÜNÜM SEKMELERİ */}
                <div className="tabs">
                    <button onClick={() => setView('orders')} className={`tab ${view === 'orders' ? 'active' : ''}`}>Açık Hesaplar</button>
                    <button onClick={() => setView('summary')} className={`tab ${view === 'summary' ? 'active' : ''}`}>Gün Özeti</button>
                </div>
            </div>
            <div ref={sentinelRef} className="menu-sentinel" aria-hidden="true" />

            <div className="panel-body">
                {view === 'summary' ? (
                    <CashierSummary onAuthError={handleSummaryAuthError} />
                ) : loading ? (
                    <div className="grid grid-cards" aria-hidden="true">
                        {[0, 1].map((i) => (
                            <div key={i} className="order-card">
                                <div className="order-head"><span className="skel w-24 h-5" /></div>
                                <ul className="order-lines">
                                    {[0, 1, 2].map((j) => (
                                        <li key={j} className="order-line"><span className="skel skel-line" /></li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="empty">
                        <div className="empty-icon"><IconCloche size={30} /></div>
                        <h3>Şu an açık masanız yok</h3>
                        <p>Yeni siparişler geldikçe burada listelenecek.</p>
                    </div>
                ) : (
                    <>
                        {/* Durum bildiren uyarı: hiç hareket etmeden belirmesi
                            gözden kaçıyordu. Giriş ve çıkış aynı yoldan
                            (yukarıdan), böylece kaybolması da kendini haber eder. */}
                        <AnimatePresence initial={false}>
                            {readyOrderCount > 0 && (
                                <m.div
                                    className="alert-banner"
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ opacity: fadeOut, y: springDefault }}
                                >
                                    <IconBell size={ICON.md} />
                                    <span><b>{readyOrderCount} masada</b> servis bekleyen sipariş var</span>
                                </m.div>
                            )}
                        </AnimatePresence>
                        {/* 5sn'lik poll listeyi baştan yazıyor: ödenen kart yok
                            olmak yerine animasyonla çıksın, kalanlar yerine
                            ışınlanmasın. */}
                        <div className="grid grid-cards">
                            <AnimatePresence initial={false}>
                                {orders.map((order) => {
                                    const ready = orderReadyCount(order.items);
                                    return (
                                        <m.div
                                            key={order.id}
                                            className={`order-card ${ready > 0 ? 'order-card--pending' : ''}`}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.97 }}
                                            transition={{ opacity: fadeOut, y: springDefault, scale: springDefault }}
                                        >
                                            <div className="order-head">
                                                <span className="order-table">
                                                    {order.table?.table_number || `Masa ID: ${order.table_id}`}
                                                </span>
                                                {ready > 0 ? (
                                                    <span className="badge-pending"><span className="dot-pending" />Servis bekliyor</span>
                                                ) : (
                                                    <span className="order-time">
                                                        açılış {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>

                                            <ul className="order-lines">
                                                {order.items.map(item => (
                                                    <li key={item.id} className="order-line">
                                                        <span className="line-qty">{item.quantity}×</span>
                                                        <span className="order-line-name">{item.product ? item.product.name : 'Ürün'}</span>
                                                        {item.stage === 'preparing' ? (
                                                            <span className="status-tag status-tag--wait">Hazırlanıyor</span>
                                                        ) : item.stage === 'ready' ? (
                                                            <button onClick={() => handleServeItem(item.id)} className="btn btn-success btn-sm"><IconCheck size={ICON.xs} />Servis Et</button>
                                                        ) : null}
                                                        <span className="order-line-price">{(item.price_at_sale * item.quantity).toFixed(2)} ₺</span>
                                                    </li>
                                                ))}
                                            </ul>

                                            <div className="order-total">
                                                <span className="order-total-label">Toplam</span>
                                                <span className="order-total-value">{calculateOrderTotal(order.items)} ₺</span>
                                            </div>
                                            {ready > 0 && (
                                                <button onClick={() => handleServeAll(order.id)} className="order-deliver">
                                                    <IconCheck size={ICON.sm} />Tümünü Servis Et ({ready} ürün)
                                                </button>
                                            )}
                                            <button onClick={() => setClosingOrder(order)} className="order-pay">
                                                <IconCard size={ICON.sm} />Hesabı Kapat / Öde
                                            </button>
                                        </m.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </>
                )}
            </div>

            {/* HESAP KAPATMA ONAY MODALI — el yapımı overlay yerine <Modal>:
                Escape, odak tuzağı, odağı geri verme, iOS-güvenli kaydırma
                kilidi ve çıkış animasyonu oradan geliyor (ASAMA-2 P1). */}
            <Modal
                open={!!closingOrder}
                onClose={() => setClosingOrder(null)}
                labelledBy="pay-title"
                className="modal modal--dialog"
            >
                {closingOrder && (
                    <>
                        <div className="confirm-icon confirm-icon--soft"><IconCard size={ICON.xl} sw={1.6} /></div>
                        <h3 className="confirm-title" id="pay-title">Hesabı kapat</h3>
                        <p className="confirm-sub">
                            {closingOrder.table?.table_number || `Masa ID: ${closingOrder.table_id}`} · <b>{calculateOrderTotal(closingOrder.items)} ₺</b> tahsil edilecek ve masa boşaltılacak.
                        </p>
                        <div className="dialog-actions">
                            <button onClick={() => setClosingOrder(null)} className="btn flex-1">Vazgeç</button>
                            <button onClick={() => handlePayOrder(closingOrder.id)} className="btn btn-success flex-[1.4]">Öde & Kapat</button>
                        </div>
                    </>
                )}
            </Modal>
        </div>
    );
}

export default Cashier;
