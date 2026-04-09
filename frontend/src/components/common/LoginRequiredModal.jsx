import { useNavigate, useLocation } from 'react-router-dom';

export default function LoginRequiredModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>

        <h2 className="mb-2 text-xl font-bold text-dark">Bạn chưa đăng nhập</h2>
        <p className="mb-6 text-sm text-gray-500">
          Vui lòng đăng nhập hoặc đăng ký để thêm sản phẩm vào giỏ hàng và tiếp tục mua sắm.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border-2 border-gray-200 py-2.5 font-medium text-gray-600 transition-all hover:bg-gray-50"
          >
            Để sau
          </button>
          <button
            onClick={() => {
              onClose();
              navigate('/auth/register', { state: { from: location.pathname } });
            }}
            className="flex-1 rounded-lg border-2 border-primary py-2.5 font-medium text-primary transition-all hover:bg-blue-50"
          >
            Đăng ký
          </button>
          <button
            onClick={() => {
              onClose();
              navigate('/auth/login', { state: { from: location.pathname } });
            }}
            className="flex-1 rounded-lg bg-primary py-2.5 font-medium text-white transition-all hover:bg-secondary"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}
