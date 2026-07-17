import { useState, useEffect } from 'react';
import { apiFetch, getToken, setToken, clearToken, UnauthorizedError } from './api';
import { IconChefHat, IconFlame, IconCheck, IconLogout, IconLogin } from './icons';

function Kitchen() {
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken('kitchen'));

    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const handleLogin = (e) => {
        e.preventDefault();
        setLoginError('');

        apiFetch('/api/kitchen/login', { method: 'POST', body: { username, password } })
            .then(res => {
                if (res.success && res.token) {
                    setToken('kitchen', res.token);
                    setIsAuthenticated(true);
                    setPassword('');
                } else {
                    setLoginError(res.message || 'Giriş başarısız!');
                }
            })
            .catch(() => setLoginError('Sunucuya bağlanılamadı.'));
    };

    const handleLogout = () => {
        apiFetch('/api/logout', { role: 'kitchen', method: 'POST' })
            .catch(() => { /* token zaten geçersizse sorun değil */ })
            .finally(() => {
                clearToken('kitchen');
                setIsAuthenticated(false);
            });
    };

    const fetchOrders = () => {
        apiFetch('/api/kitchen/orders', { role: 'kitchen' })
            .then(res => {
                if (res.success) setOrders(res.data);
                setLoading(false);
            })
            .catch(err => {
                if (err instanceof UnauthorizedError) { setIsAuthenticated(false); return; }
                console.error('Mutfak verisi çekilemedi:', err);
            });
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchOrders();
        const interval = setInterval(fetchOrders, 4000); // 4 sn'de bir yeni siparişler için yenile
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    const prepareItem = (itemId) => {
        apiFetch(`/api/kitchen/items/${itemId}/prepare`, { role: 'kitchen', method: 'POST' })
            .then(res => { if (res.success) fetchOrders(); })
            .catch(err => {
                if (err instanceof UnauthorizedError) { setIsAuthenticated(false); return; }
                alert('İşaretlenemedi, sunucuya ulaşılamıyor.');
            });
    };

    const prepareAll = (orderId) => {
        apiFetch(`/api/kitchen/orders/${orderId}/prepare`, { role: 'kitchen', method: 'POST' })
            .then(res => { if (res.success) fetchOrders(); })
            .catch(err => {
                if (err instanceof UnauthorizedError) { setIsAuthenticated(false); return; }
                alert('İşaretlenemedi, sunucuya ulaşılamıyor.');
            });
    };

    // 🔴 GİRİŞ EKRANI
    if (!isAuthenticated) {
        return (
            <div className="login-wrap">
                <form onSubmit={handleLogin} className="login-card">
                    <div className="login-head">
                        <div className="login-arch">M</div>
                        <h2>Mutfak Girişi</h2>
                        <p className="login-sub">Gelen siparişleri hazırlamak için giriş yapın</p>
                    </div>
                    <div className="login-body">
                        {loginError && <div className="alert">{loginError}</div>}
                        <div className="field">
                            <label className="label">Kullanıcı Adı</label>
                            <input type="text" className="input" value={username} onChange={e => setUsername(e.target.value)} required placeholder="kullanıcı adınız" />
                        </div>
                        <div className="field" style={{ marginBottom: 20 }}>
                            <label className="label">Şifre</label>
                            <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                        </div>
                        <button type="submit" className="btn btn-success btn-block">Giriş Yap<IconLogin /></button>
                    </div>
                </form>
            </div>
        );
    }

    // 🟢 MUTFAK PANELİ
    return (
        <div className="page">
            <div className="panel reveal">

                <div className="panel-head">
                    <div className="panel-head-left">
                        <div className="panel-icon"><IconChefHat size={22} /></div>
                        <div>
                            <div className="panel-title">Mutfak Paneli</div>
                            <div className="panel-sub">Gelen siparişler — hazırlanacaklar</div>
                        </div>
                    </div>
                    <div className="panel-actions">
                        <span className="badge-live"><span className="dot-live" />Canlı</span>
                        <button onClick={handleLogout} className="btn btn-logout btn-sm"><IconLogout size={14} />Çıkış</button>
                    </div>
                </div>

                <div className="panel-body">
                    {loading ? (
                        <div className="spinner" style={{ margin: '48px auto' }} />
                    ) : orders.length === 0 ? (
                        <div className="empty">
                            <div className="empty-icon"><IconFlame size={30} /></div>
                            <h3>Hazırlanacak sipariş yok</h3>
                            <p>Yeni siparişler geldikçe burada belirecek.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cards">
                            {orders.map((order, oi) => {
                                const pendingItems = order.items.filter(i => i.preparing_quantity > 0);
                                return (
                                    <div key={order.id} className="order-card order-card--pending reveal" style={{ '--i': oi }}>
                                        <div className="order-head">
                                            <span className="order-table">{order.table_number}</span>
                                            {order.opened_at && (
                                                <span className="order-time">
                                                    {new Date(order.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </div>

                                        <ul className="order-lines">
                                            {order.items.map(item => (
                                                <li key={item.id} className="order-line">
                                                    <span className="line-qty">{item.quantity}×</span>
                                                    <span className="order-line-name">{item.name}</span>
                                                    {item.preparing_quantity > 0 ? (
                                                        <button onClick={() => prepareItem(item.id)} className="btn btn-success btn-sm"><IconCheck size={13} />Hazır</button>
                                                    ) : (
                                                        <span className="status-tag status-tag--ok">Hazırlandı</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>

                                        {pendingItems.length > 1 && (
                                            <button onClick={() => prepareAll(order.id)} className="order-prepare">
                                                <IconChefHat size={16} />Tümünü Hazırla ({pendingItems.length})
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Kitchen;
