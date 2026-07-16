import { useState, useEffect } from 'react';
import { apiFetch, getToken, setToken, clearToken, UnauthorizedError } from './api';
import { IconCard, IconLogout, IconLogin, IconCloche } from './icons';

function Cashier() {
    // Oturum, kasa token'ının varlığına bağlı.
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken('cashier'));

    // Form State'leri
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Kasa Verileri
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    // Hesap kapatma onayı bekleyen sipariş (modal)
    const [closingOrder, setClosingOrder] = useState(null);

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
        if (!isAuthenticated) return;

        fetchActiveOrders();
        const interval = setInterval(() => {
            fetchActiveOrders();
        }, 5000);

        return () => clearInterval(interval);
    }, [isAuthenticated]);

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
                alert("Hesap kapatılamadı, sunucuya ulaşılamıyor.");
            });
    };

    const calculateOrderTotal = (items) => {
        return items.reduce((total, item) => total + (item.price_at_sale * item.quantity), 0).toFixed(2);
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
            <div className="panel reveal">

                <div className="panel-head">
                    <div className="panel-head-left">
                        <div className="panel-icon"><IconCard size={22} sw={1.5} /></div>
                        <div>
                            <div className="panel-title">Kasa & Mutfak Paneli</div>
                            <div className="panel-sub">Açık hesaplar canlı izleniyor</div>
                        </div>
                    </div>
                    <div className="panel-actions">
                        <span className="badge-live"><span className="dot-live" />Canlı Takip</span>
                        <button onClick={handleLogout} className="btn btn-logout btn-sm"><IconLogout size={14} />Çıkış</button>
                    </div>
                </div>

                <div className="panel-body">
                    {orders.length === 0 ? (
                        <div className="empty">
                            <div className="empty-icon"><IconCloche size={30} /></div>
                            <h3>Şu an açık masanız yok</h3>
                            <p>Yeni siparişler geldikçe burada listelenecek.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cards">
                            {orders.map((order, oi) => (
                                <div key={order.id} className="order-card reveal" style={{ '--i': oi }}>
                                    <div className="order-head">
                                        <span className="order-table">
                                            {order.table?.table_number || `Masa ID: ${order.table_id}`}
                                        </span>
                                        <span className="order-time">
                                            açılış {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <ul className="order-lines">
                                        {order.items.map(item => (
                                            <li key={item.id} className="order-line">
                                                <span className="line-qty">{item.quantity}×</span>
                                                <span className="order-line-name">{item.product ? item.product.name : 'Ürün'}</span>
                                                <span className="order-line-price">{(item.price_at_sale * item.quantity).toFixed(2)} ₺</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="order-total">
                                        <span className="order-total-label">Toplam</span>
                                        <span className="order-total-value">{calculateOrderTotal(order.items)} ₺</span>
                                    </div>
                                    <button onClick={() => setClosingOrder(order)} className="order-pay">
                                        <IconCard size={16} />Hesabı Kapat / Öde
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* HESAP KAPATMA ONAY MODALI */}
            {closingOrder && (
                <div className="modal-overlay" onClick={() => setClosingOrder(null)}>
                    <div className="modal modal--dialog" onClick={e => e.stopPropagation()}>
                        <div className="confirm-icon confirm-icon--soft"><IconCard size={28} sw={1.6} /></div>
                        <h3 className="confirm-title">Hesabı kapat</h3>
                        <p className="confirm-sub">
                            {closingOrder.table?.table_number || `Masa ID: ${closingOrder.table_id}`} · <b>{calculateOrderTotal(closingOrder.items)} ₺</b> tahsil edilecek ve masa boşaltılacak.
                        </p>
                        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                            <button onClick={() => setClosingOrder(null)} className="btn" style={{ flex: 1 }}>Vazgeç</button>
                            <button onClick={() => handlePayOrder(closingOrder.id)} className="btn btn-success" style={{ flex: 1.4 }}>Öde & Kapat</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Cashier;
