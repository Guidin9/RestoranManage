import { useState, useEffect } from 'react';
import { apiFetch, getToken, setToken, clearToken, IMGBB_API_KEY, UnauthorizedError } from './api';
import { IconPlus, IconTrash, IconUser, IconShield, IconLogout, IconLogin, IconLink, IconPrinter, IconMail } from './icons';

// QR kodu panelin açıldığı adresi hedefler; canlıda otomatik olarak doğru domain olur.
const menuUrlFor = (qrCode) => `${window.location.origin}/?table=${qrCode}`;
const qrImageFor = (qrCode, size) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(menuUrlFor(qrCode))}`;

function Admin() {
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => !!getToken('admin'));

    const [activeTab, setActiveTab] = useState('waiters');

    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Veri Listeleri
    const [waiters, setWaiters] = useState([]);
    const [tables, setTables] = useState([]);
    const [menu, setMenu] = useState([]);

    // Form State'leri
    const [newWaiter, setNewWaiter] = useState({ name: '', username: '', password: '' });
    const [newTableNumber, setNewTableNumber] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');

    const [newProduct, setNewProduct] = useState({ category_id: '', name: '', price: '' });
    const [imageFile, setImageFile] = useState(null);

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');

        apiFetch('/api/admin/login', { method: 'POST', body: { username, password } })
            .then(res => {
                if (res.success && res.token) {
                    setToken('admin', res.token);
                    setIsAdminLoggedIn(true);
                    setPassword('');
                } else {
                    setError(res.message || 'Giriş başarısız!');
                }
            })
            .catch(() => setError('Sunucuya bağlanılamadı.'));
    };

    const handleLogout = () => {
        apiFetch('/api/logout', { role: 'admin', method: 'POST' })
            .catch(() => { /* token zaten geçersizse sorun değil */ })
            .finally(() => {
                clearToken('admin');
                setIsAdminLoggedIn(false);
            });
    };

    // Token geçersizse giriş ekranına düş.
    const handleAuthError = (err) => {
        if (err instanceof UnauthorizedError) {
            setIsAdminLoggedIn(false);
            return true;
        }
        return false;
    };

    const loadAllData = () => {
        apiFetch('/api/admin/waiters', { role: 'admin' })
            .then(res => res.success && setWaiters(res.data))
            .catch(handleAuthError);

        apiFetch('/api/waiter/tables', { role: 'admin' })
            .then(res => res.success && setTables(res.data))
            .catch(handleAuthError);

        apiFetch('/api/waiter/menu', { role: 'admin' })
            .then(res => res.success && setMenu(res.data))
            .catch(handleAuthError);
    };

    useEffect(() => {
        if (isAdminLoggedIn) loadAllData();
    }, [isAdminLoggedIn]);

    // --- GARSON İŞLEMLERİ ---
    const addWaiter = (e) => {
        e.preventDefault();
        apiFetch('/api/admin/waiters', { role: 'admin', method: 'POST', body: newWaiter })
            .then(res => {
                if (res.success) {
                    alert(res.message);
                    setNewWaiter({ name: '', username: '', password: '' });
                    loadAllData();
                } else {
                    alert("⚠️ Hata: " + (res.message || "Garson eklenemedi."));
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) alert("Bağlantı hatası!");
            });
    };

    const deleteWaiter = (id) => {
        if (!window.confirm("Bu garsonu silmek istediğinize emin misiniz?")) return;
        apiFetch(`/api/admin/waiters/${id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError);
    };

    // --- MASA İŞLEMLERİ ---
    const addTable = (e) => {
        e.preventDefault();
        apiFetch('/api/admin/tables', { role: 'admin', method: 'POST', body: { table_number: newTableNumber } })
            .then(res => {
                if (res.success) {
                    alert(res.message);
                    setNewTableNumber('');
                    loadAllData();
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) alert("Bağlantı hatası!");
            });
    };

    const deleteTable = (id) => {
        if (!window.confirm("Masayı silmek istediğinize emin misiniz?")) return;
        apiFetch(`/api/admin/tables/${id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError);
    };

    // --- KATEGORİ İŞLEMLERİ ---
    const addCategory = (e) => {
        e.preventDefault();
        apiFetch('/api/admin/categories', { role: 'admin', method: 'POST', body: { name: newCategoryName } })
            .then(res => {
                if (res.success) {
                    alert(res.message);
                    setNewCategoryName('');
                    loadAllData();
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) alert("Bağlantı hatası!");
            });
    };

    const deleteCategory = (id) => {
        if (!window.confirm("Bu kategoriyi ve içindeki TÜM ürünleri silmek istediğinize emin misiniz?")) return;
        apiFetch(`/api/admin/categories/${id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError);
    };

    // --- ÜRÜN İŞLEMLERİ ---
    const addProduct = async (e) => {
        e.preventDefault();

        if (!newProduct.category_id || !newProduct.name || !newProduct.price) {
            alert("Lütfen tüm alanları (Kategori, Ürün Adı, Fiyat) doldurun!");
            return;
        }

        let imageUrl = null;

        if (imageFile) {
            if (!IMGBB_API_KEY) {
                alert("Görsel yüklemek için .env dosyasına VITE_IMGBB_API_KEY değerini ekleyin.");
                return;
            }

            const imgData = new FormData();
            imgData.append("image", imageFile);

            try {
                const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                    method: "POST",
                    body: imgData
                });
                const result = await response.json();

                if (result.success) {
                    imageUrl = result.data.url;
                } else {
                    alert("Resim buluta yüklenemedi!");
                    return;
                }
            } catch (error) {
                console.error("Bulut yükleme hatası:", error);
                alert("Resim yükleme servisine ulaşılamadı.");
                return;
            }
        }

        apiFetch('/api/admin/products', {
            role: 'admin',
            method: 'POST',
            body: {
                category_id: newProduct.category_id,
                name: newProduct.name,
                price: newProduct.price,
                image: imageUrl
            }
        })
            .then(res => {
                if (res.success) {
                    alert(res.message);
                    setNewProduct({ category_id: '', name: '', price: '' });
                    setImageFile(null);
                    const fileInput = document.getElementById('productImageInput');
                    if (fileInput) fileInput.value = '';
                    loadAllData();
                } else {
                    alert("⚠️ Hata: " + (res.message || "Ekleme başarısız."));
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) alert("Sunucu bağlantı hatası!");
            });
    };

    const deleteProduct = (id) => {
        if (!window.confirm("Ürünü silmek istediğinize emin misiniz?")) return;
        apiFetch(`/api/admin/products/${id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError);
    };

    if (!isAdminLoggedIn) {
        return (
            <div className="login-wrap">
                <form onSubmit={handleLogin} className="login-card">
                    <div className="login-head">
                        <div className="login-arch">A</div>
                        <h2>Admin Dashboard</h2>
                        <p className="login-sub">Yönetici kontrol paneline giriş</p>
                    </div>
                    <div className="login-body">
                        {error && <div className="alert">{error}</div>}
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

    return (
        <div className="page">
            <div className="panel reveal">

                <div className="panel-head">
                    <div className="panel-head-left">
                        <div className="panel-icon"><IconShield size={22} sw={1.5} /></div>
                        <div>
                            <div className="panel-title">Yönetici Kontrol Paneli</div>
                            <div className="panel-sub">Garson · Masa · Menü yönetimi</div>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="btn btn-logout btn-sm"><IconLogout size={14} />Çıkış</button>
                </div>

                {/* SEKMELER */}
                <div className="tabs">
                    <button onClick={() => setActiveTab('waiters')} className={`tab ${activeTab === 'waiters' ? 'active' : ''}`}>Garson Yönetimi</button>
                    <button onClick={() => setActiveTab('tables')} className={`tab ${activeTab === 'tables' ? 'active' : ''}`}>Masa Yönetimi</button>
                    <button onClick={() => setActiveTab('menu')} className={`tab ${activeTab === 'menu' ? 'active' : ''}`}>Menü & Kategori</button>
                </div>

                <div className="panel-body">

                    {/* SEKME 1: GARSON YÖNETİMİ */}
                    {activeTab === 'waiters' && (
                        <div className="reveal">
                            <form onSubmit={addWaiter} className="form-box">
                                <label className="field">
                                    <span className="label">Ad Soyad</span>
                                    <input type="text" className="input" placeholder="Ör. Ada Deniz" value={newWaiter.name} onChange={e => setNewWaiter({ ...newWaiter, name: e.target.value })} required />
                                </label>
                                <label className="field">
                                    <span className="label">Kullanıcı Adı</span>
                                    <input type="text" className="input" placeholder="ada" value={newWaiter.username} onChange={e => setNewWaiter({ ...newWaiter, username: e.target.value })} required />
                                </label>
                                <label className="field">
                                    <span className="label">Şifre</span>
                                    <input type="password" className="input" placeholder="••••••" value={newWaiter.password} onChange={e => setNewWaiter({ ...newWaiter, password: e.target.value })} required />
                                </label>
                                <button type="submit" className="btn btn-success"><IconPlus size={15} />Ekle</button>
                            </form>

                            <div className="stack" style={{ gap: 9 }}>
                                {waiters.map(w => (
                                    <div key={w.id} className="staff-row">
                                        <div className="avatar"><IconUser size={18} sw={1.6} /></div>
                                        <div style={{ flex: 1 }}>
                                            <div className="staff-name">{w.name}</div>
                                            <div className="staff-user">@{w.username}</div>
                                        </div>
                                        <button onClick={() => deleteWaiter(w.id)} className="btn btn-danger btn-sm"><IconTrash size={13} />Sil</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SEKME 2: MASA YÖNETİMİ */}
                    {activeTab === 'tables' && (
                        <div className="reveal">
                            <form onSubmit={addTable} className="form-box">
                                <label className="field">
                                    <span className="label">Masa Adı</span>
                                    <input type="text" className="input" placeholder="Ör. Teras 3" value={newTableNumber} onChange={e => setNewTableNumber(e.target.value)} required />
                                </label>
                                <button type="submit" className="btn btn-success"><IconPlus size={15} />Masa Oluştur</button>
                            </form>

                            <div className="grid grid-wide">
                                {tables.map((t, ti) => (
                                    <div key={t.id} className="table-admin-card reveal" style={{ '--i': ti }}>
                                        <div className="row-between" style={{ marginBottom: 14 }}>
                                            <span className="table-name">{t.table_number}</span>
                                            <button onClick={() => deleteTable(t.id)} className="btn-text-danger"><IconTrash size={13} />Sil</button>
                                        </div>

                                        {/* QR önizleme, test linki ve yazdırma çıktısı */}
                                        <div className="qr-box">
                                            <img className="qr-thumb" src={qrImageFor(t.qr_code, 104)} alt={`${t.table_number} QR`} />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                                                <a href={menuUrlFor(t.qr_code)} target="_blank" rel="noreferrer" className="link"><IconLink size={13} />Test Et</a>
                                                <a href={qrImageFor(t.qr_code, 500)} target="_blank" rel="noreferrer" className="btn btn-ink btn-sm"><IconPrinter size={13} />QR Çıkart</a>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SEKME 3: MENÜ & KATEGORİ YÖNETİMİ */}
                    {activeTab === 'menu' && (
                        <div className="reveal">
                            {/* KATEGORİ EKLEME FORMU */}
                            <form onSubmit={addCategory} className="form-box" style={{ marginBottom: 14 }}>
                                <label className="field">
                                    <span className="label">Yeni Kategori</span>
                                    <input type="text" className="input" placeholder="Ör. İçecekler" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} required />
                                </label>
                                <button type="submit" className="btn btn-primary"><IconPlus size={15} />Kategori Ekle</button>
                            </form>

                            {/* ÜRÜN EKLEME FORMU */}
                            <form onSubmit={addProduct} className="form-box" style={{ marginBottom: 22 }}>
                                <label className="field" style={{ flex: '1 1 130px' }}>
                                    <span className="label">Kategori</span>
                                    <select className="select" value={newProduct.category_id} onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })} required>
                                        <option value="">Kategori Seçin</option>
                                        {menu.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </label>
                                <label className="field" style={{ flex: '1.4 1 150px' }}>
                                    <span className="label">Ürün Adı</span>
                                    <input type="text" className="input" placeholder="Ör. Ege Salatası" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} required />
                                </label>
                                <label className="field" style={{ flex: '0.7 1 100px' }}>
                                    <span className="label">Fiyat ₺</span>
                                    <input type="number" step="0.01" className="input" placeholder="0" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} required />
                                </label>
                                <label className="field" style={{ flex: '1 1 130px' }}>
                                    <span className="label">Görsel</span>
                                    <input id="productImageInput" type="file" accept="image/*" className="input" onChange={(e) => setImageFile(e.target.files[0])} />
                                </label>
                                <button type="submit" className="btn btn-success"><IconPlus size={15} />Ürün Ekle</button>
                            </form>

                            {/* MENÜ LİSTESİ */}
                            {menu.length === 0 && (
                                <div className="empty">
                                    <div className="empty-icon" style={{ color: 'var(--sea)' }}><IconMail size={26} /></div>
                                    <h3>Henüz kategori veya ürün yok</h3>
                                </div>
                            )}

                            <div className="stack" style={{ gap: 16 }}>
                                {menu.map((c, ci) => (
                                    <div key={c.id} className="cat-card reveal" style={{ '--i': ci }}>
                                        <div className="cat-head">
                                            <span className="cat-name">{c.name}</span>
                                            <button onClick={() => deleteCategory(c.id)} className="btn btn-danger btn-sm">Kategoriyi Sil</button>
                                        </div>

                                        <div className="cat-items">
                                            {c.products.length === 0 && (
                                                <p className="muted" style={{ padding: '10px 5px', fontSize: 13, fontStyle: 'italic' }}>Bu kategoride ürün yok.</p>
                                            )}
                                            {c.products.map(p => (
                                                <div key={p.id} className="item-row">
                                                    {p.image_url ? (
                                                        <img src={p.image_url} alt={p.name} className="thumb-sm" />
                                                    ) : (
                                                        <div className="thumb-sm thumb-sm--empty"><span>foto</span></div>
                                                    )}
                                                    <div className="item-name">{p.name}</div>
                                                    <div className="item-price">{p.price} ₺</div>
                                                    <button onClick={() => deleteProduct(p.id)} className="btn-text-danger"><IconTrash size={13} />Sil</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default Admin;
