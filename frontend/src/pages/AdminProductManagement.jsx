import React, { useEffect, useState, useRef } from 'react';
import { useAdmin } from '@hooks/useAdmin';
import { uploadAPI } from '@services/api';

// ─── Shared attribute store (persisted in localStorage) ───────────────────────
const STORAGE_KEY_COLORS = 'admin_shared_colors';
const STORAGE_KEY_SIZES  = 'admin_shared_sizes';

const loadShared = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
};
const saveShared = (key, val) => localStorage.setItem(key, JSON.stringify(val));

const DEFAULT_COLORS = ['Đỏ','Xanh dương','Xanh lá','Đen','Trắng','Vàng','Hồng','Tím','Cam','Xám'];
const DEFAULT_SIZES  = ['XS','S','M','L','XL','XXL','3XL','38','39','40','41','42','43'];

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const fmt = v => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(v);

const STATUS_BADGE = isActive =>
  isActive
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : 'bg-rose-50 text-rose-600 border border-rose-200';

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ active }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE(active)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-rose-400'}`}/>
      {active ? 'Hiển thị' : 'Ẩn'}
    </span>
  );
}

function ImageUploader({ images, onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('images', f));
      const res = await uploadAPI.uploadImages(fd);
      const urls = res.data?.data || [];
      onChange([...images, ...urls]);
    } catch (e) {
      alert('Upload thất bại: ' + (e.response?.data?.message || e.message));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((url, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              <img src={url} alt="" className="w-full h-full object-cover"/>
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xl"
              >✕</button>
              {i === 0 && (
                <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
                  Chính
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50"
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-blue-600">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
            <span className="text-sm font-medium">Đang tải lên...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-500">
            <span className="text-3xl">🖼️</span>
            <span className="text-sm font-medium">Kéo thả hoặc click để chọn ảnh</span>
            <span className="text-xs text-slate-400">JPG, PNG, WEBP · tối đa 5MB/ảnh</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => handleFiles(e.target.files)}/>
    </div>
  );
}

function TagSelector({ label, allTags, selected, onToggle, onAddTag, onDeleteTag }) {
  const [newTag, setNewTag] = useState('');

  const add = () => {
    const t = newTag.trim();
    if (!t || allTags.includes(t)) return;
    onAddTag(t);
    setNewTag('');
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[48px]">
        {allTags.map(tag => {
          const active = selected.includes(tag);
          return (
            <div key={tag} className="flex items-center gap-0.5 group">
              <button
                type="button"
                onClick={() => onToggle(tag)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-300 hover:border-blue-400 hover:text-blue-600'
                }`}
              >{tag}</button>
              <button
                type="button"
                onClick={() => onDeleteTag(tag)}
                className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 text-xs w-4 h-4 flex items-center justify-center transition-opacity"
                title="Xóa khỏi danh sách"
              >×</button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={`Thêm ${label.toLowerCase()} mới...`}
          className="flex-1 text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 font-medium"
        >+ Thêm</button>
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-slate-500">Đã chọn: <span className="font-medium text-slate-700">{selected.join(', ')}</span></p>
      )}
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">
        {label}{required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition";

// ─── Main component ───────────────────────────────────────────────────────────
const AdminProductManagement = () => {
  const { fetchAdminProducts, fetchCategories, createProduct, updateProduct, deleteProduct, toggleProductStatus, loading } = useAdmin();

  const [products,       setProducts]       = useState([]);
  const [categories,     setCategories]     = useState([]);
  const [page,           setPage]           = useState(1);
  const [totalPages,     setTotalPages]     = useState(1);
  const [search,         setSearch]         = useState('');
  const [selCat,         setSelCat]         = useState('');
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [deleteId,       setDeleteId]       = useState(null);
  const [sortBySold,     setSortBySold]     = useState(false); // ✅ sort theo bán chạy

  const [sharedColors, setSharedColors] = useState(() => loadShared(STORAGE_KEY_COLORS, DEFAULT_COLORS));
  const [sharedSizes,  setSharedSizes]  = useState(() => loadShared(STORAGE_KEY_SIZES,  DEFAULT_SIZES));

  const emptyForm = {
    name:'', description:'', price:'', discount:'0', category:'',
    stock:'', colors:[], sizes:[], features:'', images:[]
  };
  const [form, setForm] = useState(emptyForm);

  // ── data loaders ───────────────────────────────────────────────────────────
  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadProducts();   }, [page, search, selCat]);

  const loadCategories = async () => {
    const data = await fetchCategories();
    if (data) setCategories(data);
  };

  const loadProducts = async () => {
    const data = await fetchAdminProducts({
      page, limit: 10,
      search:   search || undefined,
      category: selCat || undefined,
    });
    if (data) {
      setProducts(data.products || []);
      setTotalPages(data.pagination?.pages || 1);
    }
  };

  // ── shared tag helpers ─────────────────────────────────────────────────────
  const addSharedColor = (c) => { const next = [...sharedColors, c]; setSharedColors(next); saveShared(STORAGE_KEY_COLORS, next); };
  const delSharedColor = (c) => { const next = sharedColors.filter(x => x !== c); setSharedColors(next); saveShared(STORAGE_KEY_COLORS, next); };
  const addSharedSize  = (s) => { const next = [...sharedSizes,  s]; setSharedSizes(next);  saveShared(STORAGE_KEY_SIZES,  next); };
  const delSharedSize  = (s) => { const next = sharedSizes.filter(x => x !== s);  setSharedSizes(next);  saveShared(STORAGE_KEY_SIZES,  next); };

  const toggleColor = (c) => setForm(f => ({ ...f, colors: f.colors.includes(c) ? f.colors.filter(x=>x!==c) : [...f.colors, c] }));
  const toggleSize  = (s) => setForm(f => ({ ...f, sizes:  f.sizes.includes(s)  ? f.sizes.filter(x=>x!==s)  : [...f.sizes,  s] }));

  // ── drawer helpers ─────────────────────────────────────────────────────────
  const openCreate = () => { setEditingProduct(null); setForm(emptyForm); setDrawerOpen(true); };

  const openEdit = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name, description: p.description,
      price: p.price.toString(), discount: (p.discount||0).toString(),
      category: p.category?._id || p.category,
      stock: p.stock.toString(),
      colors: p.colors || [], sizes: p.sizes || [],
      features: (p.features||[]).join(', '),
      images: p.images || [],
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => { setDrawerOpen(false); setEditingProduct(null); };

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        price:    parseFloat(form.price),
        discount: parseFloat(form.discount || 0),
        stock:    parseInt(form.stock),
        features: form.features.split(',').map(f=>f.trim()).filter(Boolean),
      };
      if (editingProduct) await updateProduct(editingProduct._id, payload);
      else                 await createProduct(payload);
      closeDrawer();
      loadProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi lưu sản phẩm');
    } finally {
      setSaving(false);
    }
  };

  // ── delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteId) return;
    try { await deleteProduct(deleteId); loadProducts(); }
    catch { alert('Xóa thất bại'); }
    finally { setDeleteId(null); }
  };

  // ── sorted products ────────────────────────────────────────────────────────
  // ✅ Sort theo soldCount nếu bật toggle
  const displayProducts = sortBySold
    ? [...products].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    : products;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Quản lý Sản phẩm</h1>
          <p className="text-sm text-slate-500 mt-0.5">{products.length} sản phẩm trên trang này</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <span className="text-lg leading-none">+</span> Thêm sản phẩm
        </button>
      </div>

      <div className="p-6 space-y-5">

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-3 flex-wrap items-center shadow-sm">
          <div className="relative flex-1 min-w-52">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo tên sản phẩm..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selCat}
            onChange={e => { setSelCat(e.target.value); setPage(1); }}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-40"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>

          {/* ✅ Toggle sắp xếp theo bán chạy */}
          <button
            onClick={() => setSortBySold(s => !s)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              sortBySold
                ? 'bg-orange-50 border-orange-300 text-orange-600'
                : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-500'
            }`}
          >
            🔥 {sortBySold ? 'Đang xem: Bán chạy' : 'Sắp xếp bán chạy'}
          </button>
        </div>

        {/* ── Table ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {/* ✅ Thêm cột Đã bán */}
                  {['Sản phẩm', 'Danh mục', 'Giá', 'Tồn kho', 'Đã bán', 'Trạng thái', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h === 'Đã bán'
                        ? <span className="flex items-center gap-1">🔥 Đã bán</span>
                        : h
                      }
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && products.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                      <span className="text-sm">Đang tải...</span>
                    </div>
                  </td></tr>
                ) : displayProducts.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📦</span>
                      <span>Không tìm thấy sản phẩm nào</span>
                    </div>
                  </td></tr>
                ) : displayProducts.map((p, idx) => (
                  <tr key={p._id} className="hover:bg-slate-50 transition-colors group">

                    {/* Sản phẩm */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                          {p.images?.[0]
                            ? <img src={p.images[0]} alt="" className="w-full h-full object-cover"/>
                            : <div className="w-full h-full flex items-center justify-center text-slate-400 text-xl">📷</div>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 line-clamp-1">{p.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{p.description}</p>
                        </div>
                      </div>
                    </td>

                    {/* Danh mục */}
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                        {p.category?.name || '—'}
                      </span>
                    </td>

                    {/* Giá */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 whitespace-nowrap">{fmt(p.price)}</p>
                      {p.discount > 0 && (
                        <p className="text-xs text-emerald-600 font-medium">-{p.discount}%</p>
                      )}
                    </td>

                    {/* Tồn kho */}
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${p.stock > 10 ? 'text-slate-800' : p.stock > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {p.stock}
                      </span>
                      {p.stock === 0 && <span className="ml-1 text-xs text-rose-500">Hết</span>}
                    </td>

                    {/* ✅ Đã bán */}
                    <td className="px-4 py-3">
                      {(p.soldCount || 0) > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {/* Top 3 khi đang sort theo bán chạy */}
                          {sortBySold && idx === 0 && <span className="text-base">🥇</span>}
                          {sortBySold && idx === 1 && <span className="text-base">🥈</span>}
                          {sortBySold && idx === 2 && <span className="text-base">🥉</span>}
                          <span className="font-semibold text-orange-500">{p.soldCount}</span>
                          <span className="text-xs text-slate-400">sp</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Trạng thái */}
                    <td className="px-4 py-3"><Badge active={p.isActive}/></td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(p)}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors text-sm"
                          title="Chỉnh sửa">✏️</button>
                        <button
                          onClick={async () => { await toggleProductStatus(p._id); loadProducts(); }}
                          className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors text-sm"
                          title={p.isActive ? 'Ẩn sản phẩm' : 'Hiện sản phẩm'}
                        >{p.isActive ? '👁️' : '🙈'}</button>
                        <button onClick={() => setDeleteId(p._id)}
                          className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors text-sm"
                          title="Xóa">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Trang {page} / {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium">← Trước</button>
                {Array.from({length: totalPages}, (_,i) => i+1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${page===p ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 hover:bg-slate-50'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium">Sau →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Side Drawer ─────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={closeDrawer}/>
          <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full animate-slide-in overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white sticky top-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingProduct ? '✏️ Chỉnh sửa sản phẩm' : '➕ Thêm sản phẩm mới'}
                </h2>
                {editingProduct && (
                  <p className="text-sm text-slate-500 mt-0.5 truncate max-w-xs">{editingProduct.name}</p>
                )}
              </div>
              <button onClick={closeDrawer}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="px-6 py-5 space-y-6">

                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Thông tin cơ bản</h3>
                  <div className="space-y-4">
                    <FormField label="Tên sản phẩm" required>
                      <input type="text" required value={form.name}
                        onChange={e => setForm(f=>({...f, name: e.target.value}))}
                        placeholder="VD: Áo thun cotton basic"
                        className={inputCls}/>
                    </FormField>
                    <FormField label="Danh mục" required>
                      <select required value={form.category}
                        onChange={e => setForm(f=>({...f, category: e.target.value}))}
                        className={inputCls}>
                        <option value="">-- Chọn danh mục --</option>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Mô tả" required>
                      <textarea required rows={3} value={form.description}
                        onChange={e => setForm(f=>({...f, description: e.target.value}))}
                        placeholder="Mô tả chi tiết về sản phẩm..."
                        className={inputCls + ' resize-none'}/>
                    </FormField>
                  </div>
                </section>

                <hr className="border-slate-100"/>

                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Giá & Tồn kho</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField label="Giá gốc (₫)" required>
                      <input type="number" required min={0} step={1000} value={form.price}
                        onChange={e => setForm(f=>({...f, price: e.target.value}))}
                        placeholder="0" className={inputCls}/>
                    </FormField>
                    <FormField label="Giảm giá (%)">
                      <input type="number" min={0} max={100} value={form.discount}
                        onChange={e => setForm(f=>({...f, discount: e.target.value}))}
                        placeholder="0" className={inputCls}/>
                    </FormField>
                    <FormField label="Tồn kho" required>
                      <input type="number" required min={0} value={form.stock}
                        onChange={e => setForm(f=>({...f, stock: e.target.value}))}
                        placeholder="0" className={inputCls}/>
                    </FormField>
                  </div>
                  {form.price && form.discount > 0 && (
                    <p className="mt-2 text-sm text-emerald-600 font-medium">
                      💰 Giá sau giảm: {fmt(Math.round(form.price * (1 - form.discount/100)))}
                    </p>
                  )}
                </section>

                <hr className="border-slate-100"/>

                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Hình ảnh</h3>
                  <ImageUploader images={form.images} onChange={imgs => setForm(f=>({...f, images: imgs}))}/>
                </section>

                <hr className="border-slate-100"/>

                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Màu sắc</h3>
                  <TagSelector
                    label="Màu sắc" allTags={sharedColors} selected={form.colors}
                    onToggle={toggleColor} onAddTag={addSharedColor} onDeleteTag={delSharedColor}
                  />
                </section>

                <hr className="border-slate-100"/>

                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Kích thước</h3>
                  <TagSelector
                    label="Kích thước" allTags={sharedSizes} selected={form.sizes}
                    onToggle={toggleSize} onAddTag={addSharedSize} onDeleteTag={delSharedSize}
                  />
                </section>

                <hr className="border-slate-100"/>

                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Đặc điểm</h3>
                  <FormField label="Đặc điểm nổi bật (cách nhau bằng dấu phẩy)">
                    <textarea rows={2} value={form.features}
                      onChange={e => setForm(f=>({...f, features: e.target.value}))}
                      placeholder="VD: Chất liệu cotton 100%, Thoáng mát, Dễ giặt"
                      className={inputCls + ' resize-none'}/>
                  </FormField>
                </section>

              </div>

              <div className="sticky bottom-0 px-6 py-4 bg-white border-t border-slate-200 flex gap-3">
                <button type="button" onClick={closeDrawer}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                  Hủy
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                  {saving ? 'Đang lưu...' : editingProduct ? 'Cập nhật' : 'Tạo sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirm ───────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteId(null)}/>
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold text-slate-900">Xóa sản phẩm?</h3>
              <p className="text-sm text-slate-500 mt-1">Hành động này không thể hoàn tác.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                Hủy
              </button>
              <button onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-colors">
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.25s cubic-bezier(0.4,0,0.2,1); }
      `}</style>
    </div>
  );
};

export default AdminProductManagement;