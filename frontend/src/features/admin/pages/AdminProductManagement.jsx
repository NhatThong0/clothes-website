import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAdmin } from '@features/admin/hooks/useAdmin';
import { uploadAPI } from '@features/shared/services/api';

// ─── Shared color/size pool (localStorage) ────────────────────────────────────
const SK_COLORS = 'admin_colors_v2';
const SK_SIZES  = 'admin_sizes_v2';
const loadPool  = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
const savePool  = (key, val) => localStorage.setItem(key, JSON.stringify(val));

const DEFAULT_COLORS = ['Đỏ','Xanh dương','Xanh lá','Đen','Trắng','Vàng','Hồng','Tím','Cam','Xám','Be','Navy'];
const DEFAULT_SIZES  = ['XS','S','M','L','XL','XXL','3XL','38','39','40','41','42','43','44'];
const fmt = v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v ?? 0);
const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition';

const getCategorySizeChart = (category) => category?.sizeChart || null;
const getCategorySizeOptions = (category) => {
    const chart = getCategorySizeChart(category);
    if (!chart?.sizes?.length) return [];
    return [...new Set(chart.sizes.map((rule) => rule.size).filter(Boolean))];
};

const buildCategorySizeState = (categories, categoryId) => {
    const selectedCategory = categories.find((category) => category._id === categoryId) || null;
    const categorySizeChart = getCategorySizeChart(selectedCategory);
    const categorySizeOptions = getCategorySizeOptions(selectedCategory);

    return { selectedCategory, categorySizeChart, categorySizeOptions };
};

const syncVariantsWithSizeOptions = (variants, sizeOptions) => {
    if (!Array.isArray(variants)) return [];
    if (!sizeOptions?.length) return variants;
    return variants.filter((variant) => sizeOptions.includes(variant.size));
};

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ active }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                   : 'bg-rose-50 text-rose-600 border border-rose-200'
        }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-rose-400'}`}/>
            {active ? 'Hiển thị' : 'Ẩn'}
        </span>
    );
}

// ─── ImageUploader ────────────────────────────────────────────────────────────
function ImageUploader({ images, onChange }) {
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef();

    const handleFiles = async (files) => {
        if (!files.length) return;
        setUploading(true);
        try {
            const fd = new FormData();
            Array.from(files).forEach(f => fd.append('images', f));
            const res  = await uploadAPI.uploadImages(fd);
            const urls = res.data?.data || [];
            onChange([...images, ...urls]);
        } catch (e) {
            alert('Upload thất bại: ' + (e.response?.data?.message || e.message));
        } finally { setUploading(false); }
    };

    return (
        <div className="space-y-3">
            {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                    {images.map((url, i) => (
                        <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200">
                            <img src={url} alt="" className="w-full h-full object-cover"/>
                            <button type="button" onClick={() => onChange(images.filter((_,j) => j!==i))}
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xl">✕</button>
                            {i === 0 && <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">Chính</span>}
                        </div>
                    ))}
                </div>
            )}
            <div onClick={() => inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50">
                {uploading
                    ? <div className="flex flex-col items-center gap-2 text-blue-600"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/><span className="text-sm font-medium">Đang tải lên...</span></div>
                    : <div className="flex flex-col items-center gap-1 text-slate-500"><span className="text-3xl">🖼️</span><span className="text-sm font-medium">Kéo thả hoặc click để chọn ảnh</span><span className="text-xs text-slate-400">JPG, PNG, WEBP · tối đa 5MB/ảnh</span></div>
                }
            </div>
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)}/>
        </div>
    );
}

// ─── VariantMatrix ────────────────────────────────────────────────────────────
// Hiển thị bảng: hàng = màu, cột = size, ô = input số lượng
// Giống Shopee: chọn màu → xem số lượng từng size, chọn size → xem số của tổ hợp đó
// ─── VariantMatrix — thay thế component cùng tên trong AdminProductManagement.jsx
// Thay thế toàn bộ component VariantMatrix trong AdminProductManagement.jsx

function VariantMatrix({ variants, onChange, colorPool, sizePool, onAddColor, onAddSize, onDelColor, onDelSize, lockSizes = false, sizeGuideLabel = '' }) {
    const [newColor,       setNewColor]       = useState('');
    const [newSize,        setNewSize]        = useState('');
    // ✅ Lưu màu/size đã chọn riêng — không phụ thuộc vào variants
    const [selectedColors, setSelectedColors] = useState(() =>
        [...new Set(variants.map(v => v.color).filter(Boolean))]
    );
    const [selectedSizes,  setSelectedSizes]  = useState(() =>
        [...new Set(variants.map(v => v.size).filter(Boolean))]
    );

    // Khi selectedColors hoặc selectedSizes thay đổi → rebuild variants
    const rebuildVariants = (colors, sizes) => {
        if (colors.length === 0 || sizes.length === 0) return [];
        const next = [];
        for (const color of colors) {
            for (const size of sizes) {
                const existing = variants.find(v => v.color === color && v.size === size);
                next.push({ color, size, stock: existing?.stock ?? 0, sku: '', price: 0 });
            }
        }
        return next;
    };

    const handleColorClick = (color) => {
        const isActive = selectedColors.includes(color);
        const newColors = isActive
            ? selectedColors.filter(c => c !== color)
            : [...selectedColors, color];
        setSelectedColors(newColors);
        onChange(rebuildVariants(newColors, selectedSizes));
    };

    const handleSizeClick = (size) => {
        const isActive = selectedSizes.includes(size);
        const newSizes = isActive
            ? selectedSizes.filter(s => s !== size)
            : [...selectedSizes, size];
        setSelectedSizes(newSizes);
        onChange(rebuildVariants(selectedColors, newSizes));
    };

    const setStock = (color, size, stock) => {
        const val  = Math.max(0, parseInt(stock) || 0);
        const next = variants.map(v =>
            v.color === color && v.size === size ? { ...v, stock: val } : v
        );
        onChange(next);
    };

    const addNewColor = () => {
        const c = newColor.trim();
        if (!c) return;
        if (!colorPool.includes(c)) onAddColor(c);
        if (!selectedColors.includes(c)) {
            const newColors = [...selectedColors, c];
            setSelectedColors(newColors);
            onChange(rebuildVariants(newColors, selectedSizes));
        }
        setNewColor('');
    };

    const addNewSize = () => {
        const s = newSize.trim();
        if (!s) return;
        if (!sizePool.includes(s)) onAddSize(s);
        if (!selectedSizes.includes(s)) {
            const newSizes = [...selectedSizes, s];
            setSelectedSizes(newSizes);
            onChange(rebuildVariants(selectedColors, newSizes));
        }
        setNewSize('');
    };

    const grandTotal = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    const colorTotal = (color) => variants.filter(v => v.color === color).reduce((s, v) => s + (Number(v.stock) || 0), 0);
    const sizeTotal  = (size)  => variants.filter(v => v.size  === size ).reduce((s, v) => s + (Number(v.stock) || 0), 0);
    const getVariant = (color, size) => variants.find(v => v.color === color && v.size === size);

    return (
        <div className="space-y-5">

            {/* ── Chọn màu ──────────────────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Màu sắc</p>
                    {selectedColors.length > 0 && (
                        <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                            Đã chọn: {selectedColors.length} màu
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[52px]">
                    {colorPool.map(c => {
                        const isActive = selectedColors.includes(c);
                        return (
                            <div key={c} className="relative group flex items-center">
                                <button type="button" onClick={() => handleColorClick(c)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border-2 ${
                                        isActive
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
                                    }`}>
                                    {isActive && <span className="mr-1">✓</span>}{c}
                                </button>
                                <button type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelColor(c);
                                        const newColors = selectedColors.filter(x => x !== c);
                                        setSelectedColors(newColors);
                                        onChange(rebuildVariants(newColors, selectedSizes));
                                    }}
                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] items-center justify-center hidden group-hover:flex">×</button>
                            </div>
                        );
                    })}
                    {colorPool.length === 0 && <span className="text-xs text-slate-400 italic self-center">Chưa có màu — thêm bên dưới</span>}
                </div>
                <div className="flex gap-2 mt-2">
                    <input value={newColor} onChange={e => setNewColor(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNewColor())}
                        placeholder="Nhập màu mới (VD: Đỏ cam)..."
                        className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    <button type="button" onClick={addNewColor}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium">+ Thêm</button>
                </div>
            </div>

            {/* ── Chọn size ─────────────────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Kích thước</p>
                    {selectedSizes.length > 0 && (
                        <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                            Đã chọn: {selectedSizes.length} size
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[52px]">
                    {sizePool.map(s => {
                        const isActive = selectedSizes.includes(s);
                        return (
                            <div key={s} className="relative group flex items-center">
                                <button type="button" onClick={() => handleSizeClick(s)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border-2 ${
                                        isActive
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                                    }`}>
                                    {isActive && <span className="mr-1">✓</span>}{s}
                                </button>
                                {!lockSizes && (
                                    <button type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelSize(s);
                                            const newSizes = selectedSizes.filter(x => x !== s);
                                            setSelectedSizes(newSizes);
                                            onChange(rebuildVariants(selectedColors, newSizes));
                                        }}
                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] items-center justify-center hidden group-hover:flex">×</button>
                                )}
                            </div>
                        );
                    })}
                    {sizePool.length === 0 && <span className="text-xs text-slate-400 italic self-center">Chưa có size — thêm bên dưới</span>}
                </div>
                {lockSizes ? (
                    <p className="mt-2 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                        Danh sách size đang lấy từ bảng size của danh mục{sizeGuideLabel ? `: ${sizeGuideLabel}` : ''}.
                    </p>
                ) : (
                    <div className="flex gap-2 mt-2">
                        <input value={newSize} onChange={e => setNewSize(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNewSize())}
                            placeholder="Nhập size mới (VD: 4XL, 44)..."
                            className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                        <button type="button" onClick={addNewSize}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-medium">+ Thêm</button>
                    </div>
                )}
            </div>

            {/* ── Hint / Bảng ───────────────────────────────────────────────── */}
            {selectedColors.length === 0 || selectedSizes.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <div className="text-3xl mb-2">
                        {selectedColors.length === 0 && selectedSizes.length === 0 ? '🎨'
                            : selectedColors.length === 0 ? '🎨' : '📐'}
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                        {selectedColors.length === 0 && selectedSizes.length === 0
                            ? 'Chọn màu sắc và kích thước bên trên để nhập số lượng'
                            : selectedColors.length === 0
                                ? 'Cần chọn ít nhất 1 màu sắc'
                                : 'Cần chọn ít nhất 1 kích thước'}
                    </p>
                    {selectedColors.length > 0 && selectedSizes.length === 0 && (
                        <p className="text-xs text-blue-500 mt-1">Đã chọn màu: {selectedColors.join(', ')} — hãy chọn thêm kích thước</p>
                    )}
                    {selectedSizes.length > 0 && selectedColors.length === 0 && (
                        <p className="text-xs text-indigo-500 mt-1">Đã chọn size: {selectedSizes.join(', ')} — hãy chọn thêm màu sắc</p>
                    )}
                </div>
            ) : (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Số lượng tồn kho</p>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Tổng: {grandTotal} sp</span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="py-2.5 px-3 text-left text-xs font-bold text-slate-400 border-b border-slate-200">Màu \ Size</th>
                                    {selectedSizes.map(size => (
                                        <th key={size} className="py-2.5 px-2 text-center text-xs font-bold text-slate-700 border-b border-slate-200 min-w-[72px]">
                                            <div>{size}</div>
                                            <div className="text-[10px] font-normal text-slate-400">{sizeTotal(size)} sp</div>
                                        </th>
                                    ))}
                                    <th className="py-2.5 px-2 text-center text-xs font-bold text-slate-500 border-b border-slate-200">Tổng</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedColors.map((color, ci) => (
                                    <tr key={color} className={ci % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                        <td className="py-2.5 px-3 border-b border-slate-100">
                                            <div className="text-xs font-semibold text-slate-700">{color}</div>
                                            <div className="text-[10px] text-slate-400">{colorTotal(color)} sp</div>
                                        </td>
                                        {selectedSizes.map(size => {
                                            const v   = getVariant(color, size);
                                            const val = v?.stock ?? 0;
                                            return (
                                                <td key={size} className="py-2 px-1 border-b border-slate-100">
                                                    <input type="number" min={0} value={val}
                                                        onChange={e => setStock(color, size, e.target.value)}
                                                        className={`w-full text-center px-1 py-1.5 border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 transition-all ${
                                                            val === 0 ? 'border-rose-200 bg-rose-50 text-rose-400 focus:ring-rose-300'
                                                            : val <= 5 ? 'border-orange-300 bg-orange-50 text-orange-700 focus:ring-orange-300'
                                                            : 'border-slate-200 bg-white text-slate-800 focus:ring-blue-400'
                                                        }`}
                                                    />
                                                </td>
                                            );
                                        })}
                                        <td className="py-2 px-2 border-b border-slate-100 text-center">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${colorTotal(color) === 0 ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-600'}`}>
                                                {colorTotal(color)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── FormField ────────────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
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
    const [sortBySold,     setSortBySold]     = useState(false);

    const [colorPool, setColorPool] = useState(() => loadPool(SK_COLORS, DEFAULT_COLORS));
    const [sizePool,  setSizePool]  = useState(() => loadPool(SK_SIZES,  DEFAULT_SIZES));

    const emptyForm = { name:'', description:'', price:'', discount:'0', category:'', features:'', images:[], variants:[] };
    const [form, setForm] = useState(emptyForm);
    const { selectedCategory, categorySizeChart, categorySizeOptions } = useMemo(
        () => buildCategorySizeState(categories, form.category),
        [categories, form.category],
    );
    const effectiveSizePool = categorySizeOptions.length ? categorySizeOptions : sizePool;

    useEffect(() => { loadCategories(); }, []);
    useEffect(() => { loadProducts();   }, [page, search, selCat]);
    useEffect(() => {
        if (!categorySizeOptions.length) return;
        setForm((current) => {
            const normalizedVariants = syncVariantsWithSizeOptions(current.variants, categorySizeOptions);
            if (normalizedVariants.length === current.variants.length) return current;
            return { ...current, variants: normalizedVariants };
        });
    }, [categorySizeOptions]);

    const loadCategories = async () => {
        const data = await fetchCategories();
        if (data) setCategories(data);
    };

    const loadProducts = async () => {
        const data = await fetchAdminProducts({ page, limit:10, search: search || undefined, category: selCat || undefined });
        if (data) { setProducts(data.products || []); setTotalPages(data.pagination?.pages || 1); }
    };

    // Pool helpers
    const addColor = (c) => { const next = [...colorPool, c]; setColorPool(next); savePool(SK_COLORS, next); };
    const delColor = (c) => { const next = colorPool.filter(x => x !== c); setColorPool(next); savePool(SK_COLORS, next); };
    const addSize  = (s) => { const next = [...sizePool,  s]; setSizePool(next);  savePool(SK_SIZES,  next); };
    const delSize  = (s) => { const next = sizePool.filter(x => x !== s);  setSizePool(next);  savePool(SK_SIZES,  next); };

    const openCreate = () => { setEditingProduct(null); setForm(emptyForm); setDrawerOpen(true); };

    const openEdit = (p) => {
        const categoryId = p.category?._id || p.category || '';
        const { categorySizeOptions: nextSizeOptions } = buildCategorySizeState(categories, categoryId);

        setEditingProduct(p);
        setForm({
            name:        p.name,
            description: p.description,
            price:       p.price.toString(),
            discount:    (p.discount || 0).toString(),
            category:    categoryId,
            features:    (p.features || []).map(feature => `${feature}.`).join('\n'),
            images:      p.images || [],
            variants:    syncVariantsWithSizeOptions(p.variants || [], nextSizeOptions),
        });
        setDrawerOpen(true);
    };

    const closeDrawer = () => { setDrawerOpen(false); setEditingProduct(null); };

    const handleCategoryChange = (categoryId) => {
        const { categorySizeOptions: nextSizeOptions } = buildCategorySizeState(categories, categoryId);
        setForm((current) => ({
            ...current,
            category: categoryId,
            variants: syncVariantsWithSizeOptions(current.variants, nextSizeOptions),
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const normalizedVariants = syncVariantsWithSizeOptions(form.variants, categorySizeOptions)
                .filter(v => v.color && v.color.trim() && v.size && v.size.trim());
            const payload = {
                name:        form.name,
                description: form.description,
                price:       parseFloat(form.price),
                discount:    parseFloat(form.discount || 0),
                category:    form.category,
                images:      form.images,
                features:    form.features
                    .split('.')
                    .map(f => f.trim())
                    .filter(Boolean),
                variants:    normalizedVariants,
                stock:       normalizedVariants.reduce((s, v) => s + (Number(v.stock) || 0), 0),
                colors:      [...new Set(normalizedVariants.map(v => v.color))],
                sizes:       [...new Set(normalizedVariants.map(v => v.size))],
            };
            if (editingProduct) await updateProduct(editingProduct._id, payload);
            else                await createProduct(payload);
            closeDrawer();
            loadProducts();
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi khi lưu sản phẩm');
        } finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try { await deleteProduct(deleteId); loadProducts(); }
        catch { alert('Xóa thất bại'); }
        finally { setDeleteId(null); }
    };

    const displayProducts = sortBySold
        ? [...products].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
        : products;

    const totalStock = form.variants.reduce((s, v) => s + (v.stock || 0), 0);

    return (
        <div className="admin-page min-h-screen bg-slate-50">

            {/* Header */}
            <div className="bg-white/92 backdrop-blur-xl border-b border-slate-200/70 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Quản lý Sản phẩm</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{products.length} sản phẩm trên trang này</p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
                    <span className="text-lg leading-none">+</span> Thêm sản phẩm
                </button>
            </div>

            <div className="p-6 space-y-5">
                {/* Filters */}
                <div className="bg-white rounded-[28px] border border-slate-200/70 p-4 flex gap-3 flex-wrap items-center shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
                    <div className="relative flex-1 min-w-52">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                        <input type="text" value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Tìm theo tên sản phẩm..."
                            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    </div>
                    <select value={selCat} onChange={e => { setSelCat(e.target.value); setPage(1); }}
                        className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white min-w-40 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Tất cả danh mục</option>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <button onClick={() => setSortBySold(s => !s)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                            sortBySold ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300'
                        }`}>
                        🔥 {sortBySold ? 'Đang: Bán chạy' : 'Sắp xếp bán chạy'}
                    </button>
                </div>

                {/* Table */}
                <div className="bg-white rounded-[28px] border border-slate-200/70 shadow-[0_12px_40px_rgba(15,23,42,0.04)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    {['Sản phẩm', 'Danh mục', 'Giá', 'Tồn kho', 'Variants', '🔥 Đã bán', 'Trạng thái', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && products.length === 0 ? (
                                    <tr><td colSpan={8} className="px-4 py-12 text-center"><div className="flex flex-col items-center gap-2"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/><span className="text-sm text-slate-400">Đang tải...</span></div></td></tr>
                                ) : displayProducts.length === 0 ? (
                                    <tr><td colSpan={8} className="px-4 py-12 text-center"><div className="flex flex-col items-center gap-2"><span className="text-4xl">📦</span><span className="text-slate-400">Không tìm thấy sản phẩm nào</span></div></td></tr>
                                ) : displayProducts.map((p, idx) => {
                                    const activeColors = [...new Set((p.variants||[]).map(v=>v.color))];
                                    const activeSizes  = [...new Set((p.variants||[]).map(v=>v.size))];
                                    return (
                                        <tr key={p._id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                                                        {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-400 text-xl">📷</div>}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-slate-800 line-clamp-1">{p.name}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{p.description}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">{p.category?.name || '—'}</span></td>
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-slate-800 whitespace-nowrap">{fmt(p.price)}</p>
                                                {p.discount > 0 && <p className="text-xs text-emerald-600 font-medium">-{p.discount}%</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`font-bold text-sm ${p.stock > 10 ? 'text-slate-800' : p.stock > 0 ? 'text-amber-600' : 'text-rose-600'}`}>{p.stock}</span>
                                                {p.stock === 0 && <span className="ml-1 text-xs text-rose-500">Hết</span>}
                                            </td>
                                            {/* Variants summary */}
                                            <td className="px-4 py-3 max-w-[180px]">
                                                {activeColors.length > 0 ? (
                                                    <div className="space-y-1">
                                                        <div className="flex flex-wrap gap-1">
                                                            {activeColors.slice(0,3).map(c => {
                                                                const cStock = (p.variants||[]).filter(v=>v.color===c).reduce((s,v)=>s+v.stock,0);
                                                                return (
                                                                    <span key={c} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cStock===0?'bg-rose-50 text-rose-400':'bg-blue-50 text-blue-600'}`}>
                                                                        {c}:{cStock}
                                                                    </span>
                                                                );
                                                            })}
                                                            {activeColors.length > 3 && <span className="text-[10px] text-slate-400">+{activeColors.length-3}</span>}
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {activeSizes.slice(0,4).map(s => {
                                                                const sStock = (p.variants||[]).filter(v=>v.size===s).reduce((s,v)=>s+v.stock,0);
                                                                return (
                                                                    <span key={s} className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${sStock===0?'border-rose-200 text-rose-400':'border-slate-200 text-slate-500'}`}>
                                                                        {s}:{sStock}
                                                                    </span>
                                                                );
                                                            })}
                                                            {activeSizes.length > 4 && <span className="text-[10px] text-slate-400">+{activeSizes.length-4}</span>}
                                                        </div>
                                                    </div>
                                                ) : <span className="text-xs text-slate-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {(p.soldCount||0) > 0 ? (
                                                    <div className="flex items-center gap-1.5">
                                                        {sortBySold && idx===0 && <span>🥇</span>}
                                                        {sortBySold && idx===1 && <span>🥈</span>}
                                                        {sortBySold && idx===2 && <span>🥉</span>}
                                                        <span className="font-semibold text-orange-500">{p.soldCount}</span>
                                                        <span className="text-xs text-slate-400">sp</span>
                                                    </div>
                                                ) : <span className="text-slate-300 text-xs">—</span>}
                                            </td>
                                            <td className="px-4 py-3"><Badge active={p.isActive}/></td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openEdit(p)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" title="Sửa">✏️</button>
                                                    <button onClick={async () => { await toggleProductStatus(p._id); loadProducts(); }}
                                                        className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg"
                                                        title={p.isActive ? 'Ẩn' : 'Hiện'}>{p.isActive ? '👁️' : '🙈'}</button>
                                                    <button onClick={() => setDeleteId(p._id)} className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg" title="Xóa">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs text-slate-500">Trang {page} / {totalPages}</span>
                            <div className="flex gap-1">
                                <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium">← Trước</button>
                                {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                                    <button key={p} onClick={()=>setPage(p)}
                                        className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${page===p?'bg-blue-600 text-white border-blue-600':'border-slate-200 hover:bg-slate-50'}`}>{p}</button>
                                ))}
                                <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-medium">Sau →</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Drawer ──────────────────────────────────────────────────────── */}
            {drawerOpen && (
                <div className="admin-overlay fixed inset-0 z-50 p-3 sm:p-6" onClick={closeDrawer}>
                    <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <div className="admin-modal-shell w-full flex max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex-col overflow-hidden animate-slide-in">
                        <div className="admin-panel-header flex items-start justify-between gap-4 px-4 py-4 sm:px-6">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">{editingProduct ? '✏️ Chỉnh sửa sản phẩm' : '➕ Thêm sản phẩm mới'}</h2>
                                {editingProduct && <p className="text-sm text-slate-500 mt-0.5 truncate max-w-xs sm:max-w-md">{editingProduct.name}</p>}
                            </div>
                            <button onClick={closeDrawer} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 text-xl">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                            <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-6 space-y-6">

                                {/* Thông tin cơ bản */}
                                <section>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Thông tin cơ bản</h3>
                                    <div className="space-y-4">
                                        <FormField label="Tên sản phẩm" required>
                                            <input type="text" required value={form.name}
                                                onChange={e => setForm(f=>({...f,name:e.target.value}))}
                                                placeholder="VD: Áo thun cotton basic" className={inputCls}/>
                                        </FormField>
                                        <FormField label="Danh mục" required>
                                            <select required value={form.category}
                                                onChange={e => handleCategoryChange(e.target.value)}
                                                className={inputCls}>
                                                <option value="">-- Chọn danh mục --</option>
                                                {categories.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
                                            </select>
                                        </FormField>
                                        <FormField label="Mô tả" required>
                                            <textarea required rows={3} value={form.description}
                                                onChange={e => setForm(f=>({...f,description:e.target.value}))}
                                                placeholder="Mô tả chi tiết..." className={inputCls+' resize-none'}/>
                                        </FormField>
                                    </div>
                                </section>

                                <hr className="border-slate-100"/>

                                {/* Giá */}
                                <section>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Giá bán</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField label="Giá gốc (₫)" required>
                                            <input type="number" required min={0} step={1000} value={form.price}
                                                onChange={e => setForm(f=>({...f,price:e.target.value}))}
                                                placeholder="0" className={inputCls}/>
                                        </FormField>
                                        <FormField label="Giảm giá (%)">
                                            <input type="number" min={0} max={100} value={form.discount}
                                                onChange={e => setForm(f=>({...f,discount:e.target.value}))}
                                                placeholder="0" className={inputCls}/>
                                        </FormField>
                                    </div>
                                    {form.price && parseFloat(form.discount) > 0 && (
                                        <p className="mt-2 text-sm text-emerald-600 font-medium">
                                            💰 Giá sau giảm: {fmt(Math.round(parseFloat(form.price) * (1 - parseFloat(form.discount)/100)))}
                                        </p>
                                    )}
                                    {/* Stock tổng — chỉ hiển thị thông tin, KHÔNG nhập tay */}
                                    {totalStock > 0 && (
                                        <p className="mt-2 text-xs font-medium bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
                                            📦 Tổng tồn kho (tính từ variants): <span className="font-bold">{totalStock} sản phẩm</span>
                                        </p>
                                    )}
                                </section>

                                <hr className="border-slate-100"/>

                                {/* Hình ảnh */}
                                <section>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Hình ảnh</h3>
                                    <ImageUploader images={form.images} onChange={imgs=>setForm(f=>({...f,images:imgs}))}/>
                                </section>

                                <hr className="border-slate-100"/>

                                {/* Variants matrix */}
                                <section>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Màu sắc × Kích thước × Số lượng</h3>
                                    <p className="text-xs text-slate-400 mb-4">Chọn màu và size, sau đó nhập số lượng cho từng tổ hợp</p>
                                    {categorySizeChart?.sizes?.length > 0 && (
                                        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                                            Size cho sản phẩm này đang lấy theo bảng size của danh mục
                                            <span className="font-semibold"> {categorySizeChart.name || selectedCategory?.name}</span>.
                                        </div>
                                    )}
                                    <VariantMatrix
                                        variants={form.variants}
                                        onChange={v => setForm(f=>({...f,variants:v}))}
                                        colorPool={colorPool}
                                        sizePool={effectiveSizePool}
                                        onAddColor={addColor}
                                        onAddSize={addSize}
                                        onDelColor={delColor}
                                        onDelSize={delSize}
                                        lockSizes={categorySizeOptions.length > 0}
                                        sizeGuideLabel={categorySizeChart?.name || selectedCategory?.name || ''}
                                    />
                                </section>

                                <hr className="border-slate-100"/>

                                {/* Đặc điểm */}
                                <section>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Đặc điểm</h3>
                                    <FormField label="Đặc điểm nổi bật (mỗi ý kết thúc bằng dấu chấm)">
                                        <textarea rows={2} value={form.features}
                                            onChange={e=>setForm(f=>({...f,features:e.target.value}))}
                                            placeholder={"VD:\nChất liệu cotton 100%.\nThoáng mát.\nDễ giặt."}
                                            className={inputCls+' resize-none'}/>
                                    </FormField>
                                </section>
                            </div>

                                <div className="admin-panel-footer sticky bottom-0 px-4 py-4 sm:px-6">
                                <div className="mx-auto flex w-full max-w-4xl flex-col-reverse gap-3 sm:flex-row">
                                <button type="button" onClick={closeDrawer}
                                    className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50">Hủy</button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                                    {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                                    {saving ? 'Đang lưu...' : editingProduct ? 'Cập nhật' : 'Tạo sản phẩm'}
                                </button>
                                </div>
                            </div>
                        </form>
                    </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="admin-overlay absolute inset-0" onClick={()=>setDeleteId(null)}/>
                    <div className="admin-modal-shell relative p-6 w-full max-w-sm text-center">
                        <div className="text-5xl mb-3">🗑️</div>
                        <h3 className="text-lg font-bold text-slate-900">Xóa sản phẩm?</h3>
                        <p className="text-sm text-slate-500 mt-1 mb-5">Hành động này không thể hoàn tác.</p>
                        <div className="flex gap-3">
                            <button onClick={()=>setDeleteId(null)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50">Hủy</button>
                            <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold">Xóa</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slide-in { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
                .animate-slide-in { animation: slide-in 0.25s cubic-bezier(0.4,0,0.2,1); }
            `}</style>
        </div>
    );
};

export default AdminProductManagement;
