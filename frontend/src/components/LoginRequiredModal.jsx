// src/components/LoginRequiredModal.jsx
import { useNavigate, useLocation } from 'react-router-dom';

export default function LoginRequiredModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4 text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-dark mb-2">Bạn chưa đăng nhập</h2>
        <p className="text-gray-500 text-sm mb-6">
          Vui lòng đăng nhập hoặc đăng ký để thêm sản phẩm vào giỏ hàng và mua hàng.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-all"
          >
            Để sau
          </button>
          <button
            onClick={() => { onClose(); navigate('/auth/register', { state: { from: location.pathname } }); }}
            className="flex-1 py-2.5 border-2 border-primary text-primary rounded-lg font-medium hover:bg-blue-50 transition-all"
          >
            Đăng ký
          </button>
          <button
            onClick={() => { onClose(); navigate('/auth/login', { state: { from: location.pathname } }); }}
            className="flex-1 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-secondary transition-all"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}