import { useState, useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { apiFetch, getToken, setToken, clearToken, IMGBB_API_KEY, UnauthorizedError } from './api';
import { IconPlus, IconTrash, IconUser, IconLogout, IconLogin, IconLink, IconPrinter, IconMail } from './icons';
import { ICON } from './iconScale';
import { useToast } from './useToast';
import { useScrolled } from './useScrolled';
import { Modal } from './Modal';
import { fadeOut } from './motion';

// QR kodu panelin açıldığı adresi hedefler; canlıda otomatik olarak doğru domain olur.
const menuUrlFor = (qrCode) => `${window.location.origin}/?table=${qrCode}`;
const qrImageFor = (qrCode, size) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(menuUrlFor(qrCode))}`;

function Admin() {
    const toast = useToast();
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => !!getToken('admin'));

    const [activeTab, setActiveTab] = useState('waiters');
    const { scrolled, navRef, sentinelRef } = useScrolled();

    /* Silme onayı. window.confirm yerine tasarım sistemindeki <Modal>:
       confirm sayfayı bloklar, sayfanın dilinde/temasında değildir ve
       dokunmatikte akışı koparır.

       DÖRT silmenin dördünde de onay duruyor — ASAMA-2 notu yalnız kaskad
       eden kategori silmede tutmayı öneriyordu, ama geri alma (undo) yok:
       onaysız bir yanlış dokunuş veriyi kurtarmasız siliyor. Kaskad edenin
       metni ayrıca sert, çünkü tek kayıt değil bir ağaç gidiyor.
       { title, body, danger, onConfirm } */
    const [confirmState, setConfirmState] = useState(null);
    const askConfirm = (config) => setConfirmState(config);
    const runConfirm = () => {
        confirmState?.onConfirm?.();
        setConfirmState(null);
    };

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
                    toast.ok(res.message);
                    setNewWaiter({ name: '', username: '', password: '' });
                    loadAllData();
                } else {
                    toast.error(res.message || "Garson eklenemedi.");
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) toast.error("Bağlantı hatası!");
            });
    };

    const deleteWaiter = (waiter) => askConfirm({
        title: 'Garsonu sil',
        body: <><b>{waiter.name}</b> silinecek ve bu hesapla giriş yapılamayacak.</>,
        onConfirm: () => apiFetch(`/api/admin/waiters/${waiter.id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError),
    });

    // --- MASA İŞLEMLERİ ---
    const addTable = (e) => {
        e.preventDefault();
        apiFetch('/api/admin/tables', { role: 'admin', method: 'POST', body: { table_number: newTableNumber } })
            .then(res => {
                if (res.success) {
                    toast.ok(res.message);
                    setNewTableNumber('');
                    loadAllData();
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) toast.error("Bağlantı hatası!");
            });
    };

    const deleteTable = (table) => askConfirm({
        title: 'Masayı sil',
        body: <><b>{table.table_number}</b> silinecek. Bu masanın QR kodu bir daha çalışmaz — basılmışsa yenilemeniz gerekir.</>,
        onConfirm: () => apiFetch(`/api/admin/tables/${table.id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError),
    });

    // --- KATEGORİ İŞLEMLERİ ---
    const addCategory = (e) => {
        e.preventDefault();
        apiFetch('/api/admin/categories', { role: 'admin', method: 'POST', body: { name: newCategoryName } })
            .then(res => {
                if (res.success) {
                    toast.ok(res.message);
                    setNewCategoryName('');
                    loadAllData();
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) toast.error("Bağlantı hatası!");
            });
    };

    // Tek gerçekten kaskad eden silme: kategori giderse ürünleri de gider
    // (products tablosunda onDelete('cascade')).
    const deleteCategory = (category) => askConfirm({
        title: 'Kategoriyi ve ürünlerini sil',
        danger: true,
        body: <><b>{category.name}</b> kategorisiyle birlikte içindeki <b>{category.products?.length || 0} ürün</b> de silinecek. Bu işlem geri alınamaz.</>,
        onConfirm: () => apiFetch(`/api/admin/categories/${category.id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError),
    });

    // --- ÜRÜN İŞLEMLERİ ---
    const addProduct = async (e) => {
        e.preventDefault();

        if (!newProduct.category_id || !newProduct.name || !newProduct.price) {
            toast.warn("Lütfen tüm alanları (Kategori, Ürün Adı, Fiyat) doldurun!");
            return;
        }

        let imageUrl = null;

        if (imageFile) {
            if (!IMGBB_API_KEY) {
                toast.warn("Görsel yüklemek için .env dosyasına VITE_IMGBB_API_KEY değerini ekleyin.");
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
                    toast.error("Resim buluta yüklenemedi!");
                    return;
                }
            } catch (error) {
                console.error("Bulut yükleme hatası:", error);
                toast.error("Resim yükleme servisine ulaşılamadı.");
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
                    toast.ok(res.message);
                    setNewProduct({ category_id: '', name: '', price: '' });
                    setImageFile(null);
                    const fileInput = document.getElementById('productImageInput');
                    if (fileInput) fileInput.value = '';
                    loadAllData();
                } else {
                    toast.error(res.message || "Ekleme başarısız.");
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) toast.error("Sunucu bağlantı hatası!");
            });
    };

    const deleteProduct = (product) => askConfirm({
        title: 'Ürünü sil',
        body: <><b>{product.name}</b> menüden kalkacak. Açık ve geçmiş adisyonlar etkilenmez (fiyat satış anında saklanıyor).</>,
        onConfirm: () => apiFetch(`/api/admin/products/${product.id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError),
    });

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
            <div ref={navRef} className={`app-nav${scrolled ? ' is-collapsed' : ''}`}>
                <div className="app-nav-row">
                    <div className="app-nav-main">
                        <div className="app-nav-title">Yönetim</div>
                        <div className="app-nav-sub">Garson · Masa · Menü</div>
                    </div>
                    <div className="app-nav-actions">
                        <button onClick={handleLogout} className="btn btn-logout btn-sm"><IconLogout size={ICON.xs} />Çıkış</button>
                    </div>
                </div>

                {/* SEKMELER */}
                <div className="tabs">
                    <button onClick={() => setActiveTab('waiters')} className={`tab ${activeTab === 'waiters' ? 'active' : ''}`}>Garson</button>
                    <button onClick={() => setActiveTab('tables')} className={`tab ${activeTab === 'tables' ? 'active' : ''}`}>Masa</button>
                    <button onClick={() => setActiveTab('menu')} className={`tab ${activeTab === 'menu' ? 'active' : ''}`}>Menü & Kategori</button>
                </div>
            </div>
            <div ref={sentinelRef} className="menu-sentinel" aria-hidden="true" />

            {/* Sekmeler eş düzeyde: kayma değil, 150ms cross-fade. Yön veren
                bir hareket burada yanlış olurdu — hiçbiri diğerinin "altında"
                ya da "yanında" değil. */}
            <div className="panel-body">
                <AnimatePresence mode="wait" initial={false}>
                    <m.div
                        key={activeTab}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={fadeOut}
                    >

                    {/* SEKME 1: GARSON YÖNETİMİ */}
                    {activeTab === 'waiters' && (
                        <div>
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
                                        <button onClick={() => deleteWaiter(w)} className="btn btn-danger btn-sm"><IconTrash size={13} />Sil</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SEKME 2: MASA YÖNETİMİ */}
                    {activeTab === 'tables' && (
                        <div>
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
                                            <button onClick={() => deleteTable(t)} className="btn-text-danger"><IconTrash size={13} />Sil</button>
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
                        <div>
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
                                            <button onClick={() => deleteCategory(c)} className="btn btn-danger btn-sm">Kategoriyi Sil</button>
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
                                                    <button onClick={() => deleteProduct(p)} className="btn-text-danger"><IconTrash size={13} />Sil</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    </m.div>
                </AnimatePresence>
            </div>

            {/* Silme onayı — window.confirm yerine tasarım sistemi diyaloğu */}
            <Modal
                open={!!confirmState}
                onClose={() => setConfirmState(null)}
                labelledBy="confirm-delete-title"
                className="modal modal--dialog"
            >
                {confirmState && (
                    <>
                        <div className="confirm-icon confirm-icon--danger"><IconTrash size={ICON.xl} sw={1.6} /></div>
                        <h3 className="confirm-title" id="confirm-delete-title">{confirmState.title}</h3>
                        <p className="confirm-sub">{confirmState.body}</p>
                        <div className="dialog-actions">
                            <button onClick={() => setConfirmState(null)} className="btn flex-1">Vazgeç</button>
                            <button onClick={runConfirm} className="btn btn-danger-solid flex-[1.4]">
                                {confirmState.danger ? 'Hepsini Sil' : 'Sil'}
                            </button>
                        </div>
                    </>
                )}
            </Modal>
        </div>
    );
}

export default Admin;
