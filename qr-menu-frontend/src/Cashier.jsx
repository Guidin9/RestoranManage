import { useState, useEffect } from 'react';
import { apiFetch, getToken, setToken, clearToken, UnauthorizedError } from './api';

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
        if (!window.confirm("Bu masanın hesabını kapatmak istediğinize emin misiniz?")) return;

        apiFetch(`/api/cashier/orders/${orderId}/pay`, { role: 'cashier', method: 'POST' })
            .then(res => {
                if (res.success) {
                    alert("Hesap başarıyla kapatıldı!");
                    setOrders(prev => prev.filter(order => order.id !== orderId));
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
                    <span className="login-emoji">🔐</span>
                    <h2>Kasiyer Girişi</h2>
                    <p className="login-sub">Adisyon paneline erişmek için giriş yapın</p>

                    {loginError && <div className="alert">{loginError}</div>}

                    <div className="field">
                        <label className="label">Kullanıcı Adı</label>
                        <input
                            type="text"
                            className="input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder="kasa"
                        />
                    </div>

                    <div className="field">
                        <label className="label">Şifre</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-block">Giriş Yap →</button>
                </form>
            </div>
        );
    }

    // 🟢 EĞER GİRİŞ YAPILDIYSA: KASA PANELİNİ GÖSTER
    return (
        <div className="page">
            <div className="topbar">
                <h2>👨‍🍳 Kasa & Mutfak Paneli</h2>
                <div className="stepper">
                    <span className="badge badge-success"><span className="dot-live" /> Canlı Takip</span>
                    <button onClick={handleLogout} className="btn btn-danger btn-sm">🔒 Çıkış</button>
                </div>
            </div>

            {orders.length === 0 ? (
                <div className="empty">
                    <span className="empty-emoji">🍽️</span>
                    <h3>Şu an açık masanız yok</h3>
                    <p>Müşteriler QR kod ile sipariş verdiğinde adisyonlar buraya canlı düşecektir.</p>
                </div>
            ) : (
                <div className="grid grid-cards">
                    {orders.map((order, oi) => (
                        <div key={order.id} className="card reveal" style={{ '--i': oi }}>
                            <div className="row-between" style={{ paddingBottom: 12, borderBottom: '1px solid var(--glass-border)' }}>
                                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-strong)' }}>
                                    {order.table?.table_number || `Masa ID: ${order.table_id}`}
                                </span>
                                <span className="muted" style={{ fontSize: 12 }}>
                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            <ul className="prod-list" style={{ margin: '12px 0', minHeight: 90 }}>
                                {order.items.map(item => (
                                    <li key={item.id} className="row-between" style={{ padding: '6px 0', fontSize: 15 }}>
                                        <span><strong>{item.quantity}x</strong> {item.product ? item.product.name : 'Ürün'}</span>
                                        <span className="muted">{(item.price_at_sale * item.quantity).toFixed(2)} TL</span>
                                    </li>
                                ))}
                            </ul>

                            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
                                <div className="row-between" style={{ marginBottom: 12 }}>
                                    <span style={{ fontWeight: 600 }}>Toplam Tutar</span>
                                    <span className="cart-total">{calculateOrderTotal(order.items)} TL</span>
                                </div>
                                <button onClick={() => handlePayOrder(order.id)} className="btn btn-success btn-block">
                                    💳 Hesabı Kapat / Öde
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Cashier;