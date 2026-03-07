import React, { useEffect, useState, useRef } from 'react';
import { useAdmin } from '@hooks/useAdmin';
import { uploadAPI } from '@services/api';

const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition";

// ── Image Uploader ────────────────────────────────────────────────────────────
function ImageUploader({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('images', file);
      const res  = await uploadAPI.uploadImages(fd);
      const urls = res.data?.data || [];
      if (urls[0]) onChange(urls[0]);
    } catch (e) {
      alert('Upload thất bại: ' + (e.response?.data?.message || e.message));
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-2">
      {value && (
        <div className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-200 group">
          <img src={value} alt="category" className="w-full h-full object-cover"/>
          <button type="button" onClick={() => onChange('')}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-lg">
            ✕ Xóa ảnh
          </button>
        </div>
      )}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
        className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-5 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50"
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-blue-600">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
            <span className="text-xs font-medium">Đang tải lên...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400">
            <span className="text-2xl">🖼️</span>
            <span className="text-xs font-medium">{value ? 'Thay ảnh khác' : 'Kéo thả hoặc click để chọn ảnh'}</span>
            <span className="text-[11px] text-slate-300">JPG, PNG · tối đa 5MB</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => handleFile(e.target.files[0])}/>
    </div>
  );
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}/>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const AdminCategoryManagement = () => {
  const { fetchCategories, createCategory, updateCategory, deleteCategory, loading } = useAdmin();

  const [categories,      setCategories]      = useState([]);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form,            setForm]            = useState({ name: '', description: '', image: '', isFeatured: false });
  const [saving,          setSaving]          = useState(false);
  const [deleteId,        setDeleteId]        = useState(null);
  const [search,          setSearch]          = useState('');

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    const data = await fetchCategories();
    if (data) setCategories(data);
  };

  const openCreate = () => {
    setEditingCategory(null);
    setForm({ name: '', description: '', image: '', isFeatured: false });
    setDrawerOpen(true);
  };

  const openEdit = (c) => {
    setEditingCategory(c);
    setForm({
      name:        c.name,
      description: c.description || '',
      image:       c.image       || '',
      isFeatured:  c.isFeatured  || false,
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => { setDrawerOpen(false); setEditingCategory(null); };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingCategory) await updateCategory(editingCategory._id, form);
      else                  await createCategory(form);
      closeDrawer();
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi lưu danh mục');
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try { await deleteCategory(deleteId); loadCategories(); }
    catch { alert('Xóa thất bại'); }
    finally { setDeleteId(null); }
  };

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const featuredCount = categories.filter(c => c.isFeatured).length;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý Danh mục</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-sm text-slate-400">{categories.length} danh mục</p>
              {featuredCount > 0 && (
                <span className="text-xs font-semibold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">
                  ⭐ {featuredCount} nổi bật
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Tìm danh mục..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm whitespace-nowrap">
              <span className="text-lg leading-none">+</span> Thêm mới
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="p-6">
        {loading && categories.length === 0 ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 flex flex-col items-center gap-3 text-slate-400">
            <span className="text-5xl">📂</span>
            <span className="text-sm font-medium">
              {search ? 'Không tìm thấy danh mục' : 'Chưa có danh mục nào'}
            </span>
            {!search && (
              <button onClick={openCreate}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                Tạo danh mục đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(cat => (
              <div key={cat._id}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group ${
                  cat.isFeatured ? 'border-amber-200' : 'border-slate-100'
                }`}>

                {/* Image */}
                <div className="relative h-40 bg-slate-100 overflow-hidden">
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${
                      cat.isFeatured ? 'from-amber-50 to-amber-100' : 'from-slate-50 to-slate-100'
                    }`}>
                      <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                        <span className="text-3xl">📂</span>
                      </div>
                    </div>
                  )}

                  {/* isFeatured badge */}
                  {cat.isFeatured && (
                    <div className="absolute top-2 left-2 bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      ⭐ Nổi bật
                    </div>
                  )}

                  {/* Overlay actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => openEdit(cat)}
                      className="px-3 py-1.5 bg-white text-blue-600 text-xs font-bold rounded-xl hover:bg-blue-50 transition-colors">
                      ✏️ Sửa
                    </button>
                    <button onClick={() => setDeleteId(cat._id)}
                      className="px-3 py-1.5 bg-white text-rose-600 text-xs font-bold rounded-xl hover:bg-rose-50 transition-colors">
                      🗑️ Xóa
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-slate-800 text-base leading-tight">{cat.name}</h3>
                  </div>
                  {cat.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{cat.description}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {cat.productCount || 0} sản phẩm
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(cat)}
                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors text-sm">✏️</button>
                      <button onClick={() => setDeleteId(cat._id)}
                        className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors text-sm">🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add new card */}
            <button onClick={openCreate}
              className="bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-md transition-all duration-200 h-[232px] flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-blue-500 group">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
                <span className="text-2xl">+</span>
              </div>
              <span className="text-sm font-semibold">Thêm danh mục</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Drawer ──────────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={closeDrawer}/>
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full"
            style={{ animation: 'slideIn .25s cubic-bezier(.4,0,.2,1)' }}>

            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-slate-900">
                {editingCategory ? '✏️ Chỉnh sửa danh mục' : '📂 Thêm danh mục mới'}
              </h2>
              <button onClick={closeDrawer}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 text-xl">✕</button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="px-6 py-5 space-y-5">

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Tên danh mục <span className="text-rose-500">*</span>
                  </label>
                  <input type="text" required value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="VD: Áo khoác, Váy đầm..."
                    className={inputCls}/>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Mô tả</label>
                  <textarea rows={3} value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Mô tả ngắn về danh mục..."
                    className={inputCls + ' resize-none'}/>
                </div>

                {/* Image */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Hình ảnh đại diện</label>
                  <ImageUploader value={form.image} onChange={url => setForm(f => ({ ...f, image: url }))}/>
                </div>

                {/* isFeatured toggle */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Hiển thị trang chủ
                  </label>
                  <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                    form.isFeatured
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}>
                    <ToggleSwitch
                      checked={form.isFeatured}
                      onChange={val => setForm(f => ({ ...f, isFeatured: val }))}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">Danh mục nổi bật</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Hiển thị trong mục "Danh mục nổi bật" trên trang chủ
                      </p>
                    </div>
                    {form.isFeatured && (
                      <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">
                        ⭐ Đang bật
                      </span>
                    )}
                  </label>
                </div>

              </div>

              {/* Drawer footer */}
              <div className="sticky bottom-0 px-6 py-4 bg-white border-t border-slate-100 flex gap-3">
                <button type="button" onClick={closeDrawer}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Hủy
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                  {saving ? 'Đang lưu...' : editingCategory ? 'Cập nhật' : 'Tạo danh mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteId(null)}/>
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold text-slate-900">Xóa danh mục?</h3>
              <p className="text-sm text-slate-500 mt-1">Hành động này không thể hoàn tác.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">
                Hủy
              </button>
              <button onClick={confirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold">
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AdminCategoryManagement;