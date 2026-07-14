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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', fontFamily: 'sans-serif' }}>
                <form onSubmit={handleLogin} style={{ backgroundColor: '#fff', border: '1px solid #ddd', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', width: '100%', maxWidth: '350px' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>🔐 Kasiyer Girişi</h2>

                    {loginError && (
                        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '14px', textAlign: 'center' }}>
                            {loginError}
                        </div>
                    )}

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Kullanıcı Adı:</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                            placeholder="kasa"
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Şifre:</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                            placeholder="123456"
                        />
                    </div>

                    <button
                        type="submit"
                        style={{ width: '100%', padding: '12px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
                    >
                        Giriş Yap
                    </button>
                </form>
            </div>
        );
    }

    // 🟢 EĞER GİRİŞ YAPILDIYSA: KASA PANELİNİ GÖSTER
    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '15px' }}>
                <h2>👨‍🍳 Kasa & Mutfak Canlı Adisyon Paneli</h2>

                <div>
          <span style={{ backgroundColor: '#28a745', color: 'white', padding: '6px 12px', borderRadius: '15px', fontSize: '14px', marginRight: '15px' }}>
            ● Canlı Takip Açık
          </span>
                    <button
                        onClick={handleLogout}
                        style={{ padding: '6px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        🔒 Çıkış Yap
                    </button>
                </div>
            </div>

            {orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px', backgroundColor: '#f8f9fa', borderRadius: '8px', color: '#6c757d' }}>
                    <h3>Şu an açık masanız yok.</h3>
                    <p>Müşteriler QR kod ile sipariş verdiğinde adisyonlar buraya canlı düşecektir.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {orders.map(order => (
                        <div key={order.id} style={{ border: '2px solid #e0e0e0', borderRadius: '10px', padding: '15px', backgroundColor: '#fff', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #f0f0f0', paddingBottom: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                {order.table?.table_number || `Masa ID: ${order.table_id}`}
                </span>
                                <span style={{ fontSize: '12px', color: '#888' }}>
                  {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                            </div>

                            <ul style={{ listStyleType: 'none', padding: 0, margin: '10px 0', minHeight: '100px' }}>
                                {order.items.map(item => (
                                    <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: '15px' }}>
                    <span>
                      <strong>{item.quantity}x</strong> {item.product ? item.product.name : 'Ürün'}
                    </span>
                                        <span style={{ color: '#555' }}>
                      {(item.price_at_sale * item.quantity).toFixed(2)} TL
                    </span>
                                    </li>
                                ))}
                            </ul>

                            <div style={{ borderTop: '2px solid #f0f0f0', paddingTop: '10px', marginTop: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Toplam Tutar:</span>
                                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#d9534f' }}>
                    {calculateOrderTotal(order.items)} TL
                  </span>
                                </div>

                                <button
                                    onClick={() => handlePayOrder(order.id)}
                                    style={{ width: '100%', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}
                                >
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