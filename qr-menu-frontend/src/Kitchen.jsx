import { useState, useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { apiFetch, getToken, setToken, clearToken, UnauthorizedError } from './api';
import { IconChefHat, IconFlame, IconCheck, IconLogout, IconLogin } from './icons';
import { ICON } from './iconScale';
import { useToast } from './useToast';
import { useScrolled } from './useScrolled';
import { fadeOut, springDefault } from './motion';

function Kitchen() {
    const toast = useToast();
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken('kitchen'));
    const { scrolled, navRef, sentinelRef } = useScrolled();

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
                toast.error('İşaretlenemedi, sunucuya ulaşılamıyor.');
            });
    };

    const prepareAll = (orderId) => {
        apiFetch(`/api/kitchen/orders/${orderId}/prepare`, { role: 'kitchen', method: 'POST' })
            .then(res => { if (res.success) fetchOrders(); })
            .catch(err => {
                if (err instanceof UnauthorizedError) { setIsAuthenticated(false); return; }
                toast.error('İşaretlenemedi, sunucuya ulaşılamıyor.');
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
            <div ref={navRef} className={`app-nav${scrolled ? ' is-collapsed' : ''}`}>
                <div className="app-nav-row">
                    <div className="app-nav-main">
                        <div className="app-nav-title">Mutfak</div>
                        <div className="app-nav-sub">Gelen siparişler — hazırlanacaklar</div>
                    </div>
                    <div className="app-nav-actions">
                        <span className="badge-live"><span className="dot-live" />Canlı</span>
                        <button onClick={handleLogout} className="btn btn-logout btn-sm"><IconLogout size={ICON.xs} />Çıkış</button>
                    </div>
                </div>
            </div>
            <div ref={sentinelRef} className="menu-sentinel" aria-hidden="true" />

            <div className="panel-body">
                {loading ? (
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
                        <div className="empty-icon"><IconFlame size={30} /></div>
                        <h3>Hazırlanacak sipariş yok</h3>
                        <p>Yeni siparişler geldikçe burada belirecek.</p>
                    </div>
                ) : (
                    // 4sn'lik poll bu listeyi baştan yazıyor. Hazırlanan fiş
                    // yok olmak yerine animasyonla çıksın — mutfakta iki fişin
                    // yeri anlık takas olduğunda yanlış olana basılıyor.
                    <div className="grid grid-cards">
                        <AnimatePresence initial={false}>
                            {orders.map((order) => {
                                const pendingItems = order.items.filter(i => i.preparing_quantity > 0);
                                return (
                                    <m.div
                                        key={order.id}
                                        // layout prop YOK: LazyMotion domAnimation ile
                                        // yükleniyoruz, layout özelliği pakete dahil değil
                                        // (bkz. qr-menu-frontend/CLAUDE.md). Sessizce
                                        // hiçbir şey yapmazdı.
                                        className="order-card order-card--pending"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.97 }}
                                        transition={{ opacity: fadeOut, y: springDefault, scale: springDefault }}
                                    >
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
                                                        <button onClick={() => prepareItem(item.id)} className="btn btn-success btn-sm"><IconCheck size={ICON.xs} />Hazır</button>
                                                    ) : (
                                                        <span className="status-tag status-tag--ok">Hazırlandı</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>

                                        {pendingItems.length > 1 && (
                                            <button onClick={() => prepareAll(order.id)} className="order-prepare">
                                                <IconChefHat size={ICON.sm} />Tümünü Hazırla ({pendingItems.length})
                                            </button>
                                        )}
                                    </m.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Kitchen;
