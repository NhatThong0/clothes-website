import { useState, useRef } from 'react';
import apiClient from '@features/shared/services/apiClient';

export default function ARTryOnModal({ product, onClose }) {
    const [step, setStep] = useState('upload'); // 'upload' | 'processing' | 'result'
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [resultUrl, setResultUrl] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setError(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setError(null);
    };

    const handleReset = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setResultUrl(null);
        setError(null);
        setStep('upload');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleTryOn = async () => {
        if (!selectedFile) return;
        setStep('processing');
        setError(null);
        try {
            const formData = new FormData();
            formData.append('productId', product._id || product.id);
            formData.append('personImage', selectedFile);

            const res = await apiClient.post('/ar-tryon', formData, {
                timeout: 180_000, // 3 minutes — IDM-VTON takes 30-60 s
            });
            setResultUrl(res.data.data.resultUrl);
            setStep('result');
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Không thể xử lý ảnh. Vui lòng thử lại.');
            setStep('upload');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-fadeIn">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg">
                            ✨
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Thử đồ ảo</h2>
                            <p className="text-xs text-gray-400">AI Virtual Try-On · {product.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">
                        ×
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">

                    {/* ── UPLOAD STEP ─────────────────────────────────────── */}
                    {step === 'upload' && (
                        <>
                            <div className="grid grid-cols-2 gap-4 mb-5">
                                {/* Garment */}
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sản phẩm</p>
                                    <div className="relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                                        <img src={product.images?.[0]} alt={product.name}
                                            className="w-full h-52 object-cover" />
                                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 px-3 py-2">
                                            <p className="text-white text-xs font-semibold truncate">{product.name}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Person image */}
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ảnh của bạn</p>
                                    {previewUrl ? (
                                        <div className="relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                                            <img src={previewUrl} alt="Ảnh của bạn"
                                                className="w-full h-52 object-cover" />
                                            <button onClick={handleReset}
                                                className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center transition-colors font-bold">
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={handleDrop}
                                            className="w-full h-52 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50/50 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group">
                                            <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-purple-100 flex items-center justify-center text-2xl transition-colors">
                                                📷
                                            </div>
                                            <span className="text-sm font-medium text-gray-500 group-hover:text-purple-600">Chọn hoặc kéo ảnh</span>
                                            <span className="text-xs text-gray-400">Toàn thân, nền đơn giản</span>
                                        </button>
                                    )}
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                                        onChange={handleFileChange} />
                                </div>
                            </div>

                            {/* Tips */}
                            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4 text-xs text-amber-700 leading-relaxed">
                                <span className="font-semibold">Mẹo để có kết quả đẹp:</span>{' '}
                                Chụp ảnh toàn thân đứng thẳng · Nền tường trơn · Ánh sáng đủ · Không che khuất người.
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4 text-sm text-red-600">
                                    ✗ {error}
                                </div>
                            )}

                            <button onClick={handleTryOn} disabled={!selectedFile}
                                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
                                    selectedFile
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-200'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}>
                                ✨ Thử đồ với AI ngay
                            </button>
                        </>
                    )}

                    {/* ── PROCESSING STEP ──────────────────────────────────── */}
                    {step === 'processing' && (
                        <div className="flex flex-col items-center py-10 gap-5">
                            <div className="relative w-20 h-20">
                                <div className="w-20 h-20 rounded-full border-4 border-purple-100 border-t-purple-500 animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center text-2xl">🎨</div>
                            </div>
                            <div className="text-center">
                                <p className="text-base font-bold text-gray-800 mb-1">AI đang xử lý ảnh...</p>
                                <p className="text-sm text-gray-400">Quá trình mất khoảng 30–60 giây</p>
                                <p className="text-xs text-gray-300 mt-1">Vui lòng không đóng cửa sổ này</p>
                            </div>
                            <div className="flex gap-1.5">
                                {[0, 1, 2, 3].map((i) => (
                                    <div key={i} className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"
                                        style={{ animationDelay: `${i * 0.12}s` }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── RESULT STEP ──────────────────────────────────────── */}
                    {step === 'result' && resultUrl && (
                        <div>
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <span className="text-green-500 font-bold">✓</span>
                                <p className="text-sm font-semibold text-gray-700">Kết quả thử đồ của bạn</p>
                            </div>
                            <div className="rounded-xl overflow-hidden border border-gray-100 mb-4">
                                <img src={resultUrl} alt="Kết quả thử đồ" className="w-full object-contain max-h-[420px]" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={handleReset}
                                    className="py-3 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:text-purple-600 text-sm font-semibold text-gray-600 transition-all">
                                    Thử lại
                                </button>
                                <a href={resultUrl} download="ar-tryon.jpg" target="_blank" rel="noreferrer"
                                    className="py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold text-center hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-200">
                                    Lưu ảnh
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
