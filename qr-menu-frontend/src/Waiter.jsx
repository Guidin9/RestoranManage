import { useState, useEffect } from 'react';
import { apiFetch, getToken, setToken, clearToken, UnauthorizedError } from './api';

function Waiter() {
    // Token yoksa kayıtlı garson bilgisi de anlamsız; ikisini birlikte değerlendiriyoruz.
    const [waiterInfo, setWaiterInfo] = useState(() => {
        const saved = localStorage.getItem('waiter_info');
        return saved && getToken('waiter') ? JSON.parse(saved) : null;
    });

    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Veri State'leri
    const [tables, setTables] = useState([]);
    const [menu, setMenu] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);

    // 1. MANTIK: Garson Girişi
    const handleLogin = (e) => {
        e.preventDefault();
        setLoginError('');

        apiFetch('/api/waiter/login', { method: 'POST', body: { username, password } })
            .then(res => {
                if (res.success && res.token) {
                    setToken('waiter', res.token);
                    localStorage.setItem('waiter_info', JSON.stringify(res.waiter));
                    setWaiterInfo(res.waiter);
                    setPassword('');
                } else {
                    setLoginError(res.message || 'Giriş başarısız!');
                }
            })
            .catch(() => setLoginError('Sunucuya bağlanılamadı.'));
    };

    const handleLogout = () => {
        apiFetch('/api/logout', { role: 'waiter', method: 'POST' })
            .catch(() => { /* token zaten geçersizse sorun değil */ })
            .finally(() => {
                clearToken('waiter');
                localStorage.removeItem('waiter_info');
                setWaiterInfo(null);
            });
    };

    // Token geçersizse giriş ekranına düş.
    const handleAuthError = (err) => {
        if (err instanceof UnauthorizedError) {
            localStorage.removeItem('waiter_info');
            setWaiterInfo(null);
            return true;
        }
        return false;
    };

    // 2. MANTIK: Tüm Masaları ve Menüyü Yükleme
    const fetchAllData = () => {
        // Tüm masaları çek
        apiFetch('/api/waiter/tables', { role: 'waiter' })
            .then(res => {
                if (res.success) {
                    setTables(res.data);
                    // Eğer bir masa modalı açıksa, onun güncel halini de seçili tut
                    if (selectedTable) {
                        const updated = res.data.find(t => t.id === selectedTable.id);
                        if (updated) setSelectedTable(updated);
                    }
                }
            })
            .catch(handleAuthError);

        // Menüyü çek
        apiFetch('/api/waiter/menu', { role: 'waiter' })
            .then(res => {
                if (res.success) setMenu(res.data);
            })
            .catch(handleAuthError);
    };

    useEffect(() => {
        if (!waiterInfo) return;
        fetchAllData();
        const interval = setInterval(fetchAllData, 3000); // 3 saniyede bir masa durumlarını canlı yenile
        return () => clearInterval(interval);
    }, [waiterInfo, selectedTable?.id]);

    // 3. MANTIK: Masaya Ürün Ekleme (/api/orders müşteriyle ortak, herkese açık uç)
    const handleAddProduct = (tableId, productId) => {
        apiFetch('/api/orders', {
            method: 'POST',
            body: {
                table_id: tableId,
                items: [{ id: productId, quantity: 1 }]
            }
        })
            .then(res => {
                if (res.success) fetchAllData();
            })
            .catch(() => alert("Ürün eklenemedi, sunucuya ulaşılamıyor."));
    };

    // 4. MANTIK: Adisyondan Ürün Eksiltme / Silme
    const handleRemoveItem = (itemId) => {
        apiFetch(`/api/waiter/items/${itemId}/remove`, { role: 'waiter', method: 'POST' })
            .then(res => {
                if (res.success) fetchAllData();
            })
            .catch(err => {
                if (!handleAuthError(err)) alert("Ürün silinemedi, sunucuya ulaşılamıyor.");
            });
    };

    // 🔴 EĞER GİRİŞ YAPILMADIYSA: LOGIN EKRANI
    if (!waiterInfo) {
        return (
            <div className="login-wrap">
                <form onSubmit={handleLogin} className="login-card">
                    <span className="login-emoji">🤵</span>
                    <h2>Garson Girişi</h2>
                    <p className="login-sub">Masa haritasına erişmek için giriş yapın</p>
                    {loginError && <div className="alert">{loginError}</div>}
                    <div className="field">
                        <label className="label">Kullanıcı Adı</label>
                        <input type="text" className="input" value={username} onChange={e => setUsername(e.target.value)} required placeholder="ahmet" />
                    </div>
                    <div className="field">
                        <label className="label">Şifre</label>
                        <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••" />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block">Giriş Yap →</button>
                </form>
            </div>
        );
    }

    // 🟢 EĞER GİRİŞ YAPILDIYSA: FULL MASA HARİTASI
    return (
        <div className="page">

            {/* ÜST BAR */}
            <div className="topbar">
                <div>
                    <h2>🤵 Garson Masaları</h2>
                    <span className="muted" style={{ fontSize: 14 }}>
                        Personel: <strong style={{ color: 'var(--text-strong)' }}>{waiterInfo.name}</strong> (#{waiterInfo.id})
                    </span>
                </div>
                <button onClick={handleLogout} className="btn btn-danger btn-sm">🔒 Çıkış</button>
            </div>

            {/* TÜM MASALARIN LISTESİ (GRID) */}
            <div className="grid grid-tables">
                {tables.map((table, ti) => (
                    <div
                        key={table.id}
                        onClick={() => setSelectedTable(table)}
                        className={`card table-card reveal ${table.is_occupied ? 'table-card--busy' : 'table-card--free'}`}
                        style={{ '--i': ti }}
                    >
                        <div className="row-between" style={{ marginBottom: 10 }}>
                            <h3 style={{ margin: 0 }}>{table.table_number}</h3>
                            <span className={`badge ${table.is_occupied ? 'badge-danger' : 'badge-success'}`}>
                                {table.is_occupied ? 'DOLU' : 'BOŞ'}
                            </span>
                        </div>

                        {table.is_occupied ? (
                            <p className="muted" style={{ fontSize: 13 }}>
                                Adisyon: <strong style={{ color: 'var(--text-strong)' }}>{table.active_order?.items?.length || 0} Kalem Ürün</strong>
                            </p>
                        ) : (
                            <p style={{ fontSize: 13, color: '#7ff6cf' }}>Sipariş almak için tıkla</p>
                        )}
                    </div>
                ))}
            </div>

            {/* MASAYA TIKLANDIĞINDA AÇILAN SİPARİŞ / ADİSYON MODALI */}
            {selectedTable && (
                <div className="modal-overlay" onClick={() => setSelectedTable(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>

                        <div className="row-between" style={{ paddingBottom: 12, borderBottom: '1px solid var(--glass-border)' }}>
                            <h3 style={{ margin: 0 }}>{selectedTable.table_number} — Adisyon</h3>
                            <button onClick={() => setSelectedTable(null)} className="modal-close">✖</button>
                        </div>

                        {/* BÖLÜM 1: MEVCUT ADİSYON & ÜRÜN SİLME */}
                        <div className="subpanel">
                            <h4 style={{ marginTop: 0 }}>📋 Masadaki Güncel Adisyon</h4>

                            {selectedTable.is_occupied && selectedTable.active_order?.items?.length > 0 ? (
                                <ul className="prod-list">
                                    {selectedTable.active_order.items.map(item => (
                                        <li key={item.id} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--glass-border)' }}>
                                            <span>
                                                <strong>{item.quantity}x</strong> {item.product ? item.product.name : 'Ürün'} — {(item.price_at_sale * item.quantity).toFixed(2)} TL
                                            </span>
                                            <button onClick={() => handleRemoveItem(item.id)} className="btn btn-danger btn-sm">🗑️ Eksilt</button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="muted">Bu masada henüz açık bir adisyon yok. Aşağıdan ürün ekleyebilirsiniz.</p>
                            )}
                        </div>

                        {/* BÖLÜM 2: MASAYA MENÜDEN ÜRÜN EKLEME */}
                        <div style={{ marginTop: 20 }}>
                            <h4 style={{ marginBottom: 12, color: 'var(--info)' }}>➕ Masaya Ürün Ekle</h4>

                            {menu.map(category => (
                                <div key={category.id} className="subpanel" style={{ marginTop: 12 }}>
                                    <h5 className="cat-title" style={{ marginTop: 0, fontSize: 15 }}>{category.name}</h5>
                                    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                                        {category.products.map(product => (
                                            <div key={product.id} className="row-between" style={{ padding: 10, borderRadius: 10, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', fontSize: 13 }}>
                                                <div>
                                                    <div><strong>{product.name}</strong></div>
                                                    <small className="prod-price">{product.price} TL</small>
                                                </div>
                                                <button onClick={() => handleAddProduct(selectedTable.id, product.id)} className="btn btn-success btn-sm">+ Ekle</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: 20 }}>
                            <button onClick={() => setSelectedTable(null)} className="btn btn-block">Pencereyi Kapat</button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

export default Waiter;