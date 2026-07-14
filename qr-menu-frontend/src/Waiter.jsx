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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', fontFamily: 'sans-serif' }}>
                <form onSubmit={handleLogin} style={{ backgroundColor: '#fff', border: '1px solid #ddd', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', width: '350px' }}>
                    <h2 style={{ textAlign: 'center', color: '#333' }}>🤵 Garson Girişi</h2>
                    {loginError && <p style={{ color: 'red', textAlign: 'center' }}>{loginError}</p>}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ fontWeight: 'bold' }}>Kullanıcı Adı:</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: '10px', marginTop: '5px' }} placeholder="ahmet" />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ fontWeight: 'bold' }}>Şifre:</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px', marginTop: '5px' }} placeholder="123456" />
                    </div>
                    <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Giriş Yap</button>
                </form>
            </div>
        );
    }

    // 🟢 EĞER GİRİŞ YAPILDIYSA: FULL MASA HARİTASI
    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>

            {/* ÜST BAR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ margin: 0 }}>🤵 Garson Masaları</h2>
                    <span style={{ fontSize: '14px', color: '#555' }}>
            Personel: <strong>{waiterInfo.name}</strong> (#{waiterInfo.id})
          </span>
                </div>
                <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🔒 Çıkış</button>
            </div>

            {/* TÜM MASALARIN LISTESİ (GRID) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                {tables.map(table => (
                    <div
                        key={table.id}
                        onClick={() => setSelectedTable(table)}
                        style={{
                            border: '2px solid',
                            borderColor: table.is_occupied ? '#dc3545' : '#28a745',
                            borderRadius: '10px',
                            padding: '15px',
                            backgroundColor: table.is_occupied ? '#fff5f5' : '#f8fff8',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h3 style={{ margin: 0 }}>{table.table_number}</h3>
                            <span style={{ backgroundColor: table.is_occupied ? '#dc3545' : '#28a745', color: 'white', padding: '3px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                {table.is_occupied ? 'DOLU' : 'BOŞ'}
              </span>
                        </div>

                        {table.is_occupied ? (
                            <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                                Adisyon: <strong>{table.active_order?.items?.length || 0} Kalem Ürün</strong>
                            </p>
                        ) : (
                            <p style={{ margin: 0, fontSize: '13px', color: '#28a745' }}>Sipariş almak için tıkla</p>
                        )}
                    </div>
                ))}
            </div>

            {/* MASAYA TIKLANDIĞINDA AÇILAN SİPARİŞ / ADİSYON MODALI */}
            {selectedTable && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', width: '90%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto' }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
                            <h3 style={{ margin: 0 }}>{selectedTable.table_number} — Sipariş & Adisyon Yönetimi</h3>
                            <button onClick={() => setSelectedTable(null)} style={{ border: 'none', background: 'none', fontSize: '22px', cursor: 'pointer' }}>✖</button>
                        </div>

                        {/* BÖLÜM 1: MEVCUT ADİSYON & ÜRÜN SİLME */}
                        <div style={{ marginTop: '15px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
                            <h4 style={{ marginTop: 0, color: '#333' }}>📋 Masadaki Güncel Adisyon</h4>

                            {selectedTable.is_occupied && selectedTable.active_order?.items?.length > 0 ? (
                                <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                                    {selectedTable.active_order.items.map(item => (
                                        <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', paddingBottom: '5px', borderBottom: '1px solid #ddd' }}>
                      <span>
                        <strong>{item.quantity}x</strong> {item.product ? item.product.name : 'Ürün'} — {(item.price_at_sale * item.quantity).toFixed(2)} TL
                      </span>
                                            <button
                                                onClick={() => handleRemoveItem(item.id)}
                                                style={{ padding: '4px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                            >
                                                🗑️ 1 Eksilt / Sil
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ color: '#888', margin: 0 }}>Bu masada henüz açık bir adisyon yok. Aşağıdan ürün ekleyebilirsiniz.</p>
                            )}
                        </div>

                        {/* BÖLÜM 2: MASAYA MENÜDEN ÜRÜN EKLEME */}
                        <div style={{ marginTop: '20px' }}>
                            <h4 style={{ marginBottom: '10px', color: '#17a2b8' }}>➕ Masaya Ürün Ekle (Menü)</h4>

                            {menu.map(category => (
                                <div key={category.id} style={{ marginBottom: '15px', border: '1px solid #eee', padding: '10px', borderRadius: '6px' }}>
                                    <h5 style={{ margin: '0 0 8px 0', color: 'orange' }}>{category.name}</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                                        {category.products.map(product => (
                                            <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #ddd', padding: '8px', borderRadius: '4px', fontSize: '13px' }}>
                                                <div>
                                                    <div><strong>{product.name}</strong></div>
                                                    <small style={{ color: '#666' }}>{product.price} TL</small>
                                                </div>
                                                <button
                                                    onClick={() => handleAddProduct(selectedTable.id, product.id)}
                                                    style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}
                                                >
                                                    + Ekle
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                            <button
                                onClick={() => setSelectedTable(null)}
                                style={{ width: '100%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Pencereyi Kapat
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

export default Waiter;