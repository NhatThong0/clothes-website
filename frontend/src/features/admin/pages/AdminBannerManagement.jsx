import React, { useEffect, useState, useRef } from 'react';
import { uploadAPI } from '@features/shared/services/api';
import apiClient from '@features/shared/services/apiClient';

const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition";

function ImageUploader({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef();
  const handle = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('images', file);
      const res = await uploadAPI.uploadImages(fd);
      const urls = res.data?.data || [];
      if (urls[0]) onChange(urls[0]);
    } catch (e) { alert('Upload thất bại'); }
    finally { setUploading(false); }
  };
  return (
    <div className="space-y-2">
      {value && (
        <div className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 group">
          <img src={value} alt="" className="w-full h-full object-cover"/>
          <button type="button" onClick={() => onChange('')}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold">
            ✕ Xóa ảnh
          </button>
        </div>
      )}
      <div onClick={() => ref.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handle(e.dataTransfer.files[0]); }}
        className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50">
        {uploading
          ? <div className="flex flex-col items-center gap-2 text-blue-600">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
              <span className="text-xs">Đang tải lên...</span>
            </div>
          : <div className="flex flex-col items-center gap-1 text-slate-400">
              <span className="text-xl">🖼️</span>
              <span className="text-xs font-medium">{value ? 'Thay ảnh' : 'Kéo thả hoặc click · Tỉ lệ 16:7 tốt nhất'}</span>
            </div>
        }
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => handle(e.target.files[0])}/>
    </div>
  );
}

const emptyForm = { image:'', title:'', subtitle:'', link:'', isActive:true };

// ── API helpers ───────────────────────────────────────────────────────────────
const bannerAPI = {
  getAll:   ()       => apiClient.get('/banners/admin'),
  create:   (data)   => apiClient.post('/banners', data),
  update:   (id, d)  => apiClient.put(`/banners/${id}`, d),
  delete:   (id)     => apiClient.delete(`/banners/${id}`),
  reorder:  (id, o)  => apiClient.put(`/banners/${id}`, { order: o }),
};

const AdminBannerManagement = () => {
  const [banners,    setBanners]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [deleteId,   setDeleteId]   = useState(null);
  const [preview,    setPreview]    = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await bannerAPI.getAll();
      setBanners(res.data?.data || []);
    } catch { /* handled */ }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDrawerOpen(true); };
  const openEdit   = b  => { setEditing(b); setForm({ image:b.image, title:b.title||'', subtitle:b.subtitle||'', link:b.link||'', isActive:b.isActive }); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.image) { alert('Vui lòng chọn ảnh banner'); return; }
    setSaving(true);
    try {
      if (editing) await bannerAPI.update(editing._id, form);
      else          await bannerAPI.create(form);
      closeDrawer(); load();
    } catch (err) { alert(err.response?.data?.message || 'Lỗi khi lưu'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (b) => {
    try { await bannerAPI.update(b._id, { isActive: !b.isActive }); load(); }
    catch { /* handled */ }
  };

  const move = async (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= banners.length) return;
    const arr = [...banners];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setBanners(arr);
    await Promise.all([
      bannerAPI.reorder(arr[idx]._id, idx),
      bannerAPI.reorder(arr[next]._id, next),
    ]);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try { await bannerAPI.delete(deleteId); load(); }
    catch { alert('Xóa thất bại'); }
    finally { setDeleteId(null); }
  };

  const f = (k,v) => setForm(p => ({...p,[k]:v}));

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý Banner</h1>
            <p className="text-sm text-slate-400 mt-0.5">{banners.length} banner · Kéo để sắp xếp thứ tự</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
            <span className="text-lg leading-none">+</span> Thêm Banner
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">

        {/* Preview note */}
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          <span>ℹ️</span>
          <span>Banner hiển thị theo thứ tự từ trên xuống. Dùng nút ↑ ↓ để thay đổi thứ tự.</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : banners.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 flex flex-col items-center gap-3 text-slate-400">
            <span className="text-5xl">🖼️</span>
            <span className="text-sm font-medium">Chưa có banner nào</span>
            <button onClick={openCreate} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
              Thêm banner đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((b, idx) => (
              <div key={b._id}
                className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md group ${
                  b.isActive ? 'border-slate-100' : 'border-slate-200 opacity-60'
                }`}>
                <div className="flex items-stretch gap-0">
                  {/* Thumbnail */}
                  <button onClick={() => setPreview(b.image)}
                    className="relative w-48 md:w-64 flex-shrink-0 rounded-l-2xl overflow-hidden group/img">
                    <img src={b.image} alt={b.title} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"/>
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity text-sm font-bold">🔍 Xem</span>
                    </div>
                  </button>

                  {/* Content */}
                  <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                            {b.isActive
                              ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">● Hiển thị</span>
                              : <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">○ Ẩn</span>
                            }
                          </div>
                          {b.title
                            ? <h3 className="font-bold text-slate-800 text-base truncate">{b.title}</h3>
                            : <p className="text-slate-400 text-sm italic">Không có tiêu đề</p>
                          }
                          {b.subtitle && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{b.subtitle}</p>}
                          {b.link && <p className="text-xs text-blue-500 mt-1 truncate font-mono">🔗 {b.link}</p>}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(b)}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors text-sm" title="Sửa">✏️</button>
                          <button onClick={() => toggleActive(b)}
                            className={`p-2 rounded-lg transition-colors text-sm ${b.isActive ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-emerald-50 text-emerald-600'}`}
                            title={b.isActive ? 'Ẩn' : 'Hiện'}>
                            {b.isActive ? '🙈' : '👁️'}
                          </button>
                          <button onClick={() => setDeleteId(b._id)}
                            className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors text-sm" title="Xóa">🗑️</button>
                        </div>
                      </div>
                    </div>

                    {/* Reorder */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50">
                      <span className="text-xs text-slate-400 font-medium">Thứ tự:</span>
                      <button onClick={() => move(idx, -1)} disabled={idx === 0}
                        className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-lg text-slate-600 text-sm font-bold transition-colors">↑</button>
                      <button onClick={() => move(idx, 1)} disabled={idx === banners.length - 1}
                        className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-lg text-slate-600 text-sm font-bold transition-colors">↓</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={closeDrawer}/>
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full"
            style={{animation:'slideIn .25s cubic-bezier(.4,0,.2,1)'}}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-bold text-slate-900">
                {editing ? '✏️ Chỉnh sửa Banner' : '🖼️ Thêm Banner mới'}
              </h2>
              <button onClick={closeDrawer} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="px-6 py-5 space-y-5">

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Ảnh Banner <span className="text-rose-500">*</span>
                  </label>
                  <ImageUploader value={form.image} onChange={url => f('image', url)}/>
                  <p className="text-[11px] text-slate-400">Khuyến nghị tỉ lệ 16:7 (VD: 1600×700px)</p>
                </div>

                <hr className="border-slate-100"/>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Tiêu đề</label>
                  <input type="text" value={form.title} onChange={e => f('title',e.target.value)}
                    placeholder="VD: Bộ sưu tập Hè 2025" className={inputCls}/>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Mô tả phụ</label>
                  <input type="text" value={form.subtitle} onChange={e => f('subtitle',e.target.value)}
                    placeholder="VD: Giảm đến 40% toàn bộ sản phẩm" className={inputCls}/>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Đường dẫn (link)</label>
                  <input type="text" value={form.link} onChange={e => f('link',e.target.value)}
                    placeholder="VD: /products hoặc /products?sale=true" className={inputCls}/>
                  <p className="text-[11px] text-slate-400">Để trống nếu không muốn có nút "Xem ngay"</p>
                </div>

                <hr className="border-slate-100"/>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Hiển thị banner</p>
                    <p className="text-xs text-slate-400 mt-0.5">Bật để hiện trên trang chủ</p>
                  </div>
                  <button type="button" onClick={() => f('isActive',!form.isActive)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-0.5'}`}/>
                  </button>
                </div>
              </div>

              <div className="sticky bottom-0 px-6 py-4 bg-white border-t border-slate-100 flex gap-3">
                <button type="button" onClick={closeDrawer}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                  {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Tạo Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteId(null)}/>
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">🗑️</div>
              <h3 className="text-lg font-bold text-slate-900">Xóa banner này?</h3>
              <p className="text-sm text-slate-500 mt-1">Hành động này không thể hoàn tác.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">Hủy</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview */}
      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90" onClick={() => setPreview(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={preview} alt="Preview" className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]"/>
            <button onClick={() => setPreview(null)}
              className="absolute -top-4 -right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-lg font-bold text-lg">✕</button>
          </div>
        </div>
      )}

      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
};

export default AdminBannerManagement;
