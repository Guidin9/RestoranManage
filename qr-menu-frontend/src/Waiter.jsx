import { useState, useEffect } from 'react';
import { apiFetch, getToken, setToken, clearToken, UnauthorizedError } from './api';
import { IconPlus, IconMinus, IconX, IconUser, IconLogout, IconLogin, IconCalendar } from './icons';

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

    // Adisyon toplamı (yalnızca görünüm için)
    const orderItems = selectedTable?.active_order?.items || [];
    const orderTotal = orderItems.reduce((sum, item) => sum + item.price_at_sale * item.quantity, 0).toFixed(2);

    // 🔴 EĞER GİRİŞ YAPILMADIYSA: LOGIN EKRANI
    if (!waiterInfo) {
        return (
            <div className="login-wrap">
                <form onSubmit={handleLogin} className="login-card">
                    <div className="login-head">
                        <div className="login-arch">G</div>
                        <h2>Garson Girişi</h2>
                        <p className="login-sub">Masalarınızı yönetmek için giriş yapın</p>
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

    // 🟢 EĞER GİRİŞ YAPILDIYSA: FULL MASA HARİTASI
    return (
        <div className="page">
            <div className="panel reveal">

                {/* ÜST BAR */}
                <div className="panel-head">
                    <div className="panel-head-left">
                        <div className="panel-icon"><IconUser size={22} sw={1.5} /></div>
                        <div>
                            <div className="panel-title">Garson Masaları</div>
                            <div className="panel-sub">{waiterInfo.name} · #{waiterInfo.id}</div>
                        </div>
                    </div>
                    <div className="panel-actions">
                        <span className="badge-live"><span className="dot-live" />Canlı takip</span>
                        <button onClick={handleLogout} className="btn btn-logout btn-sm"><IconLogout size={14} />Çıkış</button>
                    </div>
                </div>

                {/* TÜM MASALARIN LISTESİ (GRID) */}
                <div className="panel-body">
                    <div className="grid grid-tables">
                        {tables.map((table, ti) => (
                            <button
                                key={table.id}
                                onClick={() => setSelectedTable(table)}
                                className={`table-card reveal ${table.is_occupied ? 'table-card--busy' : 'table-card--free'}`}
                                style={{ '--i': ti }}
                            >
                                <div className="row-between">
                                    <span className="table-name">{table.table_number}</span>
                                    <span className={`table-status ${table.is_occupied ? 'table-status--busy' : 'table-status--free'}`}>
                                        {table.is_occupied ? 'DOLU' : 'BOŞ'}
                                    </span>
                                </div>
                                <div className="table-meta">
                                    {table.is_occupied
                                        ? `${table.active_order?.items?.length || 0} kalem ürün`
                                        : 'sipariş almak için dokunun'}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* MASAYA TIKLANDIĞINDA AÇILAN SİPARİŞ / ADİSYON MODALI */}
            {selectedTable && (
                <div className="modal-overlay" onClick={() => setSelectedTable(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>

                        <div className="modal-head">
                            <span className="modal-title">{selectedTable.table_number}</span>
                            <button onClick={() => setSelectedTable(null)} className="modal-close"><IconX size={17} /></button>
                        </div>

                        <div className="modal-body">

                            {/* BÖLÜM 1: MEVCUT ADİSYON & ÜRÜN SİLME */}
                            <h4 className="section-title"><IconCalendar />Masadaki Güncel Adisyon</h4>

                            {selectedTable.is_occupied && orderItems.length > 0 ? (
                                <div className="stack" style={{ gap: 8, marginBottom: 22 }}>
                                    {orderItems.map(item => (
                                        <div key={item.id} className="line-row">
                                            <span className="line-qty">{item.quantity}×</span>
                                            <span className="line-name">{item.product ? item.product.name : 'Ürün'}</span>
                                            <span className="line-price">{(item.price_at_sale * item.quantity).toFixed(2)} ₺</span>
                                            <button onClick={() => handleRemoveItem(item.id)} className="btn btn-danger btn-sm"><IconMinus size={13} />Eksilt</button>
                                        </div>
                                    ))}
                                    <div className="total-row"><span>Toplam</span><span>{orderTotal} ₺</span></div>
                                </div>
                            ) : (
                                <div className="hint-box" style={{ marginBottom: 22 }}>Bu masada henüz ürün yok — aşağıdan ekleyin.</div>
                            )}

                            {/* BÖLÜM 2: MASAYA MENÜDEN ÜRÜN EKLEME */}
                            <h4 className="section-title section-title--add"><IconPlus size={15} />Masaya Ürün Ekle</h4>

                            {menu.map(category => (
                                <div key={category.id}>
                                    <div className="section-label">{category.name}</div>
                                    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                        {category.products.map(product => (
                                            <div key={product.id} className="add-chip">
                                                <div className="add-chip-body">
                                                    <div className="add-chip-name">{product.name}</div>
                                                    <div className="add-chip-price">{product.price} ₺</div>
                                                </div>
                                                <button onClick={() => handleAddProduct(selectedTable.id, product.id)} className="btn btn-success btn-sm"><IconPlus size={12} />Ekle</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <button onClick={() => setSelectedTable(null)} className="btn btn-ink btn-block" style={{ marginTop: 22 }}>Pencereyi Kapat</button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

export default Waiter;
