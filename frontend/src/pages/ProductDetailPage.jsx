import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Loading from '@components/Loading';
import Error from '@components/Error';
import { useCart } from '@hooks/useCart';
import { formatPrice } from '@utils/helpers';
import { productAPI } from '@services/api';
import { useAuth } from '@context/AuthContext';

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }) {
    useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-semibold ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
            <span>{type === 'error' ? '✗' : '✓'}</span>
            <span>{message}</span>
        </div>
    );
}

export default function ProductDetailPage() {
    const { id }       = useParams();
    const navigate     = useNavigate();
    const { addToCart } = useCart();
    const { isAuthenticated } = useAuth();

    const [product,        setProduct]        = useState(null);
    const [loading,        setLoading]        = useState(true);
    const [error,          setError]          = useState(null);
    const [quantity,       setQuantity]       = useState(1);
    const [selectedImage,  setSelectedImage]  = useState(0);
    const [selectedColor,  setSelectedColor]  = useState('');
    const [selectedSize,   setSelectedSize]   = useState('');
    const [reviews,        setReviews]        = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [myReview,       setMyReview]       = useState(null);
    const [editMode,       setEditMode]       = useState(false);
    const [editForm,       setEditForm]       = useState({ rating: 5, comment: '' });
    const [previewImg,     setPreviewImg]     = useState(null);
    const [starFilter,     setStarFilter]     = useState(0);
    const [toast,          setToast]          = useState(null);

    const showToast = (msg, type = 'success') => setToast({ message: msg, type });

    useEffect(() => { fetchProduct(); fetchReviews(); fetchMyReview(); }, [id]);

    const fetchProduct = async () => {
        try {
            setLoading(true); setError(null);
            const res  = await productAPI.getProductById(id);
            const data = res.data?.data || res.data;
            if (!data) throw new Error('Không tìm thấy sản phẩm');

            const p = {
                id:              data._id || data.id,
                _id:             data._id || data.id,
                name:            data.name,
                description:     data.description || '',
                price:           data.price,
                discountedPrice: data.discount > 0 ? Math.round(data.price * (1 - data.discount / 100)) : data.price,
                discount:        data.discount || 0,
                category:        data.category?.name || data.category || '',
                images:          data.images?.length > 0 ? data.images : ['https://placehold.co/500x600?text=No+Image'],
                rating:          data.averageRating || data.rating || 0,
                reviewCount:     data.reviewCount || (Array.isArray(data.reviews) ? data.reviews.length : 0),
                stock:           data.stock ?? 0,
                variants:        data.variants || [],
                colors:          data.colors || [],
                sizes:           data.sizes  || [],
                features:        data.features || [],
                isActive:        data.isActive,
                soldCount:       data.soldCount || 0,
            };
            setProduct(p);

            // Auto-select: màu đầu tiên còn hàng
            const activeColors = [...new Set(p.variants.map(v => v.color))];
            if (activeColors.length > 0) {
                const firstColor = activeColors.find(c =>
                    p.variants.filter(v => v.color === c).some(v => v.stock > 0)
                ) || activeColors[0];
                setSelectedColor(firstColor);
                // Auto-select size đầu tiên còn hàng với màu đó
                const sizesForColor = p.variants.filter(v => v.color === firstColor && v.stock > 0);
                if (sizesForColor.length > 0) setSelectedSize(sizesForColor[0].size);
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Đã có lỗi xảy ra');
        } finally { setLoading(false); }
    };

    const fetchReviews = async () => {
        try { setReviewsLoading(true); const res = await productAPI.getReviews(id); setReviews(res.data?.data || []); }
        catch {} finally { setReviewsLoading(false); }
    };

    const fetchMyReview = async () => {
        try { const res = await productAPI.getMyReview(id); setMyReview(res.data?.data || null); }
        catch { setMyReview(null); }
    };

    // ── Variant computed values ───────────────────────────────────────────────

    // Danh sách màu duy nhất
    const allColors = useMemo(() => [...new Set((product?.variants||[]).map(v=>v.color))], [product]);

    // Stock tổng của 1 màu (tất cả size)
    const colorTotalStock = useMemo(() => {
        const map = {};
        allColors.forEach(c => {
            map[c] = (product?.variants||[]).filter(v=>v.color===c).reduce((s,v)=>s+v.stock,0);
        });
        return map;
    }, [product, allColors]);

    // Danh sách size còn available khi đã chọn màu
    const sizesForSelectedColor = useMemo(() => {
        if (!product || !selectedColor) return [];
        return product.variants
            .filter(v => v.color === selectedColor)
            .sort((a, b) => {
                // Sort size: XS→3XL trước, sau đó số
                const order = ['XS','S','M','L','XL','XXL','3XL'];
                const ai = order.indexOf(a.size), bi = order.indexOf(b.size);
                if (ai >= 0 && bi >= 0) return ai - bi;
                if (ai >= 0) return -1;
                if (bi >= 0) return 1;
                return parseInt(a.size) - parseInt(b.size);
            });
    }, [product, selectedColor]);

    // Stock của tổ hợp đang chọn
    const selectedVariant = useMemo(() => {
        if (!product || !selectedColor || !selectedSize) return null;
        return product.variants.find(v => v.color === selectedColor && v.size === selectedSize) || null;
    }, [product, selectedColor, selectedSize]);

    const variantStock = selectedVariant?.stock ?? 0;
    const outOfStock   = !selectedVariant || variantStock === 0;

    // Khi đổi màu → reset size, auto-select size đầu tiên còn hàng
    const handleColorSelect = (color) => {
        setSelectedColor(color);
        setSelectedSize('');
        setQuantity(1);
        const sizesAvail = (product?.variants||[]).filter(v=>v.color===color && v.stock>0);
        if (sizesAvail.length > 0) setSelectedSize(sizesAvail[0].size);
    };

    // ── Review stats ──────────────────────────────────────────────────────────
    const starCounts = useMemo(() => {
        const c = {1:0,2:0,3:0,4:0,5:0};
        reviews.forEach(r => { if (c[r.rating]!==undefined) c[r.rating]++; });
        return c;
    }, [reviews]);
    const avgRating = useMemo(() => {
        if (!reviews.length) return 0;
        return (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1);
    }, [reviews]);
    const filteredReviews = useMemo(() => starFilter===0 ? reviews : reviews.filter(r=>r.rating===starFilter), [reviews, starFilter]);

    // ── Cart handlers ─────────────────────────────────────────────────────────
    const handleAddToCart = async () => {
        if (!product) return;
        if (!selectedColor) { showToast('Vui lòng chọn màu sắc', 'error'); return; }
        if (!selectedSize)  { showToast('Vui lòng chọn kích thước', 'error'); return; }
        if (outOfStock)     { showToast('Sản phẩm đã hết hàng', 'error'); return; }
        try {
            await addToCart({ ...product, image: product.images[0] }, quantity, selectedColor, selectedSize);
            if (isAuthenticated) showToast(`Đã thêm ${quantity} sản phẩm vào giỏ hàng`);
        } catch (err) { showToast(err.message || 'Không thể thêm vào giỏ hàng', 'error'); }
    };

    const handleBuyNow = async () => {
        if (!product) return;
        if (!selectedColor) { showToast('Vui lòng chọn màu sắc', 'error'); return; }
        if (!selectedSize)  { showToast('Vui lòng chọn kích thước', 'error'); return; }
        if (outOfStock)     { showToast('Sản phẩm đã hết hàng', 'error'); return; }
        if (!isAuthenticated) {
            await addToCart({ ...product, image: product.images[0] }, quantity, selectedColor, selectedSize);
            return;
        }
        try {
            await addToCart({ ...product, image: product.images[0] }, quantity, selectedColor, selectedSize);
            sessionStorage.setItem('checkoutItems', JSON.stringify([{
                id: product.id, _id: product._id, name: product.name,
                price: product.discountedPrice || product.price,
                image: product.images[0], color: selectedColor, size: selectedSize, quantity,
            }]));
            navigate('/checkout');
        } catch (err) { showToast(err.message || 'Không thể thêm vào giỏ hàng', 'error'); }
    };

    const handleDeleteMyReview = async () => {
        if (!window.confirm('Xóa đánh giá này?')) return;
        try { await productAPI.deleteReview(id, myReview._id); setMyReview(null); fetchReviews(); }
        catch (err) { showToast(err.response?.data?.message || 'Không thể xóa', 'error'); }
    };

    const handleUpdateReview = async () => {
        try {
            await productAPI.updateReview(id, myReview._id, editForm);
            setMyReview({...myReview,...editForm}); setEditMode(false); fetchReviews();
        } catch (err) { showToast(err.response?.data?.message || 'Không thể cập nhật', 'error'); }
    };

    // ── Guards ────────────────────────────────────────────────────────────────
    if (loading)  return <Loading />;
    if (error)    return <Error message={error} onRetry={fetchProduct} />;
    if (!product) return <Error message="Không tìm thấy sản phẩm" />;

    const hasVariants = product.variants?.length > 0;

    return (
        <div className="bg-white rounded-lg shadow-sm-blue p-6 md:p-10">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

                {/* ── Images ──────────────────────────────────────────────────── */}
                <div>
                    <div className="relative">
                        <img src={product.images[selectedImage]} alt={product.name}
                            className={`w-full rounded-lg shadow-md mb-4 bg-light object-cover cursor-zoom-in ${outOfStock ? 'grayscale opacity-70' : ''}`}
                            style={{ maxHeight:'500px' }}
                            onClick={() => setPreviewImg(product.images[selectedImage])}/>
                        {outOfStock && selectedColor && selectedSize && (
                            <div className="absolute inset-0 mb-4 rounded-lg flex items-center justify-center bg-black/25">
                                <span className="bg-white text-red-600 font-bold text-lg px-6 py-2 rounded-full shadow-lg">Hết hàng</span>
                            </div>
                        )}
                    </div>
                    {product.images.length > 1 && (
                        <div className="grid grid-cols-4 gap-2">
                            {product.images.map((img,i) => (
                                <img key={i} src={img} alt={`Thumbnail ${i+1}`} onClick={() => setSelectedImage(i)}
                                    className={`w-full rounded-lg cursor-pointer transition-all object-cover h-20 ${selectedImage===i?'ring-2 ring-primary opacity-100':'hover:opacity-75 opacity-60'}`}/>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Info ────────────────────────────────────────────────────── */}
                <div>
                    <div className="mb-4">
                        <span className="inline-block px-3 py-1 bg-primary text-white rounded-full text-sm font-semibold">{product.category}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-dark mb-2">{product.name}</h1>

                    {product.rating > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex">
                                {[...Array(5)].map((_,i)=>(
                                    <svg key={i} className={`w-5 h-5 ${i<Math.round(product.rating)?'fill-yellow-400':'fill-gray-300'}`} viewBox="0 0 20 20">
                                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                                    </svg>
                                ))}
                            </div>
                            <span className="text-gray-500 text-sm">({product.reviewCount} đánh giá)</span>
                        </div>
                    )}
                    {product.soldCount > 0 && <p className="text-orange-500 font-semibold text-sm mb-4">🔥 Đã bán {product.soldCount} sản phẩm</p>}

                    <div className="flex items-baseline space-x-3 mb-6">
                        <span className="text-4xl font-bold text-primary">{formatPrice(product.discountedPrice)}</span>
                        {product.discount > 0 && (
                            <>
                                <span className="text-xl text-gray-400 line-through">{formatPrice(product.price)}</span>
                                <span className="text-lg font-bold text-red-500">-{product.discount}%</span>
                            </>
                        )}
                    </div>

                    {product.description && <p className="text-gray-600 mb-6 leading-relaxed">{product.description}</p>}

                    {/* ── Variant selector (Shopee-style) ─────────────────────── */}
                    {hasVariants && (
                        <div className="mb-6 space-y-5 p-4 bg-slate-50 rounded-xl border border-slate-200">

                            {/* Chọn màu */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm font-semibold text-dark">
                                        Màu sắc
                                        {selectedColor && <span className="ml-2 text-primary font-bold">{selectedColor}</span>}
                                    </p>
                                    {selectedColor && (
                                        <span className="text-xs text-slate-500">
                                            Còn <span className="font-bold text-slate-700">{colorTotalStock[selectedColor] || 0}</span> sp (tổng tất cả size)
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {allColors.map(color => {
                                        const total     = colorTotalStock[color] || 0;
                                        const isSelected = selectedColor === color;
                                        return (
                                            <button key={color} type="button"
                                                onClick={() => handleColorSelect(color)}
                                                disabled={total === 0}
                                                className={`relative px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                                    isSelected
                                                        ? 'border-primary bg-primary/5 text-primary font-semibold'
                                                        : total === 0
                                                            ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                                                            : 'border-gray-300 text-dark hover:border-primary'
                                                }`}>
                                                {color}
                                                {total === 0 && (
                                                    <span className="absolute inset-0 flex items-center justify-center">
                                                        <span className="absolute w-full h-px bg-gray-300 rotate-[-12deg]"/>
                                                    </span>
                                                )}
                                                {/* Badge: ít hàng */}
                                                {total > 0 && total <= 10 && !isSelected && (
                                                    <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-orange-500 text-white px-1 py-0.5 rounded-full font-bold leading-none">
                                                        {total}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Chọn size — chỉ hiện sau khi chọn màu */}
                            {selectedColor && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm font-semibold text-dark">
                                            Kích thước
                                            {selectedSize && <span className="ml-2 text-primary font-bold">{selectedSize}</span>}
                                        </p>
                                        {selectedSize && selectedVariant && (
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                variantStock === 0 ? 'bg-rose-100 text-rose-600'
                                                : variantStock <= 5 ? 'bg-orange-100 text-orange-600'
                                                : 'bg-green-100 text-green-700'
                                            }`}>
                                                {variantStock === 0 ? 'Hết hàng' : `Còn ${variantStock} sp`}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {sizesForSelectedColor.map(v => {
                                            const isSelected  = selectedSize === v.size;
                                            const isEmpty     = v.stock === 0;
                                            return (
                                                <button key={v.size} type="button"
                                                    onClick={() => { if (!isEmpty) { setSelectedSize(v.size); setQuantity(1); } }}
                                                    disabled={isEmpty}
                                                    className={`relative px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                                        isSelected
                                                            ? 'border-primary bg-primary/5 text-primary font-semibold'
                                                            : isEmpty
                                                                ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                                                                : 'border-gray-300 text-dark hover:border-primary'
                                                    }`}>
                                                    {v.size}
                                                    {/* Stock badge trên từng size */}
                                                    {!isEmpty && v.stock <= 5 && (
                                                        <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-orange-500 text-white px-1 py-0.5 rounded-full font-bold leading-none">
                                                            {v.stock}
                                                        </span>
                                                    )}
                                                    {isEmpty && (
                                                        <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-gray-400 text-white px-1 rounded-full font-bold">hết</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Trạng thái */}
                            {selectedColor && selectedSize && (
                                <div className={`text-sm font-semibold flex items-center gap-2 ${outOfStock ? 'text-red-600' : 'text-green-600'}`}>
                                    {outOfStock ? (
                                        <>✗ Hết hàng — <span className="text-xs font-normal text-gray-400">Vui lòng chọn màu hoặc size khác</span></>
                                    ) : (
                                        <>✓ Còn <span className="font-bold">{variantStock}</span> sản phẩm ({selectedColor} / {selectedSize})</>
                                    )}
                                </div>
                            )}
                            {selectedColor && !selectedSize && (
                                <p className="text-sm text-slate-500">👆 Vui lòng chọn kích thước</p>
                            )}
                            {!selectedColor && (
                                <p className="text-sm text-slate-500">👆 Vui lòng chọn màu sắc</p>
                            )}
                        </div>
                    )}

                    {/* Số lượng */}
                    {!outOfStock && selectedColor && selectedSize && (
                        <div className="flex items-center space-x-4 mb-8">
                            <span className="font-semibold text-dark">Số lượng:</span>
                            <div className="flex items-center border border-gray-300 rounded-lg">
                                <button onClick={() => setQuantity(Math.max(1, quantity-1))} className="px-4 py-2 text-dark hover:bg-light transition-all">−</button>
                                <span className="px-6 py-2 font-semibold">{quantity}</span>
                                <button onClick={() => setQuantity(Math.min(variantStock, quantity+1))} className="px-4 py-2 text-dark hover:bg-light transition-all">+</button>
                            </div>
                            {variantStock <= 10 && <span className="text-xs text-orange-500 font-medium">Chỉ còn {variantStock} sp</span>}
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-4 mb-8">
                        <button onClick={handleAddToCart}
                            disabled={!selectedColor || !selectedSize || outOfStock}
                            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                                !selectedColor || !selectedSize || outOfStock
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-primary text-white hover:bg-secondary shadow-md-blue'
                            }`}>
                            {!selectedColor ? 'Chọn màu trước' : !selectedSize ? 'Chọn size trước' : outOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
                        </button>
                        <button onClick={handleBuyNow}
                            disabled={!selectedColor || !selectedSize || outOfStock}
                            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all border-2 ${
                                !selectedColor || !selectedSize || outOfStock
                                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'border-primary text-primary hover:bg-light'
                            }`}>
                            {outOfStock ? 'Không có sẵn' : 'Mua ngay'}
                        </button>
                    </div>

                    {product.features.length > 0 && (
                        <div className="border-t border-gray-200 pt-6">
                            <h3 className="font-semibold text-dark mb-3">Đặc điểm</h3>
                            <ul className="space-y-2">
                                {product.features.map((f,i) => (
                                    <li key={i} className="flex items-center text-gray-600">
                                        <span className="w-2 h-2 bg-primary rounded-full mr-3 flex-shrink-0"/>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* ── Reviews ──────────────────────────────────────────────── */}
                    <div className="mt-12 border-t border-gray-200 pt-10">
                        <h2 className="text-2xl font-bold text-dark mb-6">
                            Đánh giá sản phẩm
                            {reviews.length > 0 && <span className="ml-3 text-lg font-normal text-gray-500">({reviews.length} đánh giá)</span>}
                        </h2>

                        {myReview && (
                            <div className="mb-6 p-4 border-2 border-primary rounded-xl bg-blue-50">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="font-semibold text-primary">⭐ Đánh giá của bạn</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditForm({rating:myReview.rating,comment:myReview.comment}); setEditMode(true); }} className="text-sm text-blue-600 hover:underline">✏️ Sửa</button>
                                        <button onClick={handleDeleteMyReview} className="text-sm text-red-500 hover:underline">🗑️ Xóa</button>
                                    </div>
                                </div>
                                <div className="flex mb-2">{[...Array(5)].map((_,i)=><span key={i} className={`text-lg ${i<myReview.rating?'text-yellow-400':'text-gray-300'}`}>★</span>)}</div>
                                <p className="text-gray-700">{myReview.comment}</p>
                                {myReview.images?.length > 0 && (
                                    <div className="flex gap-2 mt-3 flex-wrap">
                                        {myReview.images.map((img,i)=>(
                                            <img key={i} src={img} alt="" className="w-20 h-20 object-cover rounded-lg border cursor-pointer hover:opacity-80" onClick={()=>setPreviewImg(img)}/>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {reviews.length > 0 && (
                            <div className="bg-gray-50 rounded-2xl p-5 mb-6">
                                <div className="flex items-center gap-6 flex-wrap">
                                    <div className="text-center flex-shrink-0">
                                        <p className="text-5xl font-black text-dark">{avgRating}</p>
                                        <div className="flex justify-center my-1">{[...Array(5)].map((_,i)=><span key={i} className={`text-xl ${i<Math.round(avgRating)?'text-yellow-400':'text-gray-300'}`}>★</span>)}</div>
                                        <p className="text-xs text-gray-400">{reviews.length} đánh giá</p>
                                    </div>
                                    <div className="flex-1 min-w-48 space-y-1.5">
                                        {[5,4,3,2,1].map(star => {
                                            const count = starCounts[star]||0;
                                            const pct   = reviews.length ? Math.round((count/reviews.length)*100) : 0;
                                            const active = starFilter===star;
                                            return (
                                                <button key={star} onClick={()=>setStarFilter(active?0:star)}
                                                    className={`w-full flex items-center gap-2 group rounded-lg px-2 py-1 transition-all ${active?'bg-yellow-50 ring-1 ring-yellow-300':'hover:bg-gray-100'}`}>
                                                    <span className={`text-xs font-bold w-5 flex-shrink-0 ${active?'text-yellow-500':'text-gray-500'}`}>{star}★</span>
                                                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                                        <div className={`h-2 rounded-full transition-all duration-300 ${active?'bg-yellow-400':'bg-yellow-300 group-hover:bg-yellow-400'}`} style={{width:`${pct}%`}}/>
                                                    </div>
                                                    <span className={`text-xs w-6 text-right flex-shrink-0 ${active?'text-yellow-600 font-bold':'text-gray-400'}`}>{count}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {starFilter > 0 && (
                                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                                        <span className="text-sm text-gray-500">Đang lọc:</span>
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold border border-yellow-200">
                                            {'★'.repeat(starFilter)} {starFilter} sao
                                            <button onClick={()=>setStarFilter(0)} className="ml-1 text-yellow-500 hover:text-yellow-700 font-bold">×</button>
                                        </span>
                                        <span className="text-sm text-gray-400">({filteredReviews.length} kết quả)</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {reviewsLoading ? <Loading/> : filteredReviews.length===0 ? (
                            <div className="text-center py-12 bg-light rounded-xl">
                                <div className="text-5xl mb-3">{starFilter>0?'🔍':'💬'}</div>
                                <p className="text-gray-500">{starFilter>0?`Không có đánh giá ${starFilter} sao.`:'Chưa có đánh giá nào. Hãy là người đầu tiên!'}</p>
                                {starFilter>0 && <button onClick={()=>setStarFilter(0)} className="mt-3 text-sm text-blue-500 hover:underline">Xem tất cả đánh giá</button>}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {filteredReviews.map((review,i) => (
                                    <div key={review._id||i} className="bg-light rounded-xl p-6">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                                                    {review.userId?.name?.[0]?.toUpperCase()||'U'}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-dark">{review.userId?.name||'Người dùng'}</p>
                                                    <p className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</p>
                                                </div>
                                            </div>
                                            <div className="flex">{[...Array(5)].map((_,i)=><span key={i} className={`text-lg ${i<review.rating?'text-yellow-400':'text-gray-300'}`}>★</span>)}</div>
                                        </div>
                                        <p className="text-gray-700 leading-relaxed mb-4">{review.comment}</p>
                                        {review.images?.length > 0 && (
                                            <div className="flex gap-3 flex-wrap">
                                                {review.images.map((img,i)=>(
                                                    <img key={i} src={img} alt="" className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-all border border-gray-200" onClick={()=>setPreviewImg(img)}/>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Preview Modal */}
            {previewImg && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={()=>setPreviewImg(null)}>
                    <div className="relative max-w-3xl w-full">
                        <img src={previewImg} alt="Preview" className="w-full rounded-xl object-contain max-h-[85vh]"/>
                        <button onClick={()=>setPreviewImg(null)} className="absolute top-3 right-3 bg-white text-black rounded-full w-9 h-9 flex items-center justify-center font-bold text-lg hover:bg-gray-200">✕</button>
                    </div>
                </div>
            )}

            {/* Edit Review Modal */}
            {editMode && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
                        <h2 className="text-xl font-bold mb-4">Sửa đánh giá</h2>
                        <div className="flex gap-2 mb-4">
                            {[1,2,3,4,5].map(star=>(
                                <button key={star} onClick={()=>setEditForm(p=>({...p,rating:star}))}
                                    className={`text-3xl transition-transform hover:scale-110 ${star<=editForm.rating?'text-yellow-400':'text-gray-300'}`}>★</button>
                            ))}
                        </div>
                        <textarea rows={4} value={editForm.comment} onChange={e=>setEditForm(p=>({...p,comment:e.target.value}))}
                            placeholder="Nội dung đánh giá..."
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none resize-none mb-4 focus:ring-2 focus:ring-primary"/>
                        <div className="flex gap-3">
                            <button onClick={()=>setEditMode(false)} className="flex-1 py-2.5 border-2 border-gray-300 rounded-lg font-semibold text-gray-600 hover:bg-gray-50">Hủy</button>
                            <button onClick={handleUpdateReview} className="flex-1 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-secondary transition-all">Lưu</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}