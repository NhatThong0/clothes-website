// src/pages/AuthPage.jsx
import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import apiClient from '@services/apiClient';
import { validateEmail, validatePassword } from '@utils/helpers';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Quay về trang trước sau khi đăng nhập, mặc định về '/'
  const from = location.state?.from || '/';

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        if (!validateEmail(formData.email)) {
          setError('Email không hợp lệ');
          return;
        }
        if (!formData.password) {
          setError('Vui lòng nhập mật khẩu');
          return;
        }
        // Gọi API đăng nhập
        const response = await apiClient.post('/auth/login', {
          email: formData.email,
          password: formData.password,
        });

        if (response.data.status === 'success') {
          const userData = response.data.data.user;
          const token = response.data.data.token;

          if (userData.role === 'admin') {
            setError('Vui lòng sử dụng Admin Portal để đăng nhập');
            return;
          }
          
          login(userData, token);
          setFormData({ email: '', password: '', fullName: '', confirmPassword: '' });
          navigate(from, { replace: true }); // 👈 quay về trang trước
        } else {
          setError(response.data.message || 'Đăng nhập thất bại');
        }
      } else {
        if (!formData.fullName) {
          setError('Vui lòng nhập họ và tên');
          return;
        }
        if (!validateEmail(formData.email)) {
          setError('Email không hợp lệ');
          return;
        }
        if (!validatePassword(formData.password)) {
          setError('Mật khẩu phải có ít nhất 6 ký tự');
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Mật khẩu không khớp');
          return;
        }
        // Gọi API đăng ký
        const response = await apiClient.post('/auth/register', {
          name: formData.fullName,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        });

        if (response.data.status === 'success') {
          const userData = response.data.data.user;
          const token = response.data.data.token;

          login(userData, token);
          setFormData({ email: '', password: '', fullName: '', confirmPassword: '' });
          navigate(from, { replace: true }); // 👈 quay về trang trước
        } else {
          setError(response.data.message || 'Đăng ký thất bại');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Đã có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <h1 className="text-2xl font-bold text-dark">Fashion Hub</h1>
          <p className="text-xs text-gray-600 mt-1">Khách hàng</p>
        </div>

        <h2 className="text-3xl font-bold text-dark mb-2 text-center">
          {isLogin ? 'Đăng nhập' : 'Đăng ký'}
        </h2>
        <p className="text-center text-gray-600 mb-8">
          {isLogin ? 'Chào mừng trở lại!' : 'Tạo tài khoản mới'}
        </p>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6 text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <input
              type="text"
              name="fullName"
              placeholder="Họ và tên"
              value={formData.fullName}
              onChange={handleInputChange}
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50"
            />
          )}

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleInputChange}
            disabled={loading}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50"
          />

          <input
            type="password"
            name="password"
            placeholder="Mật khẩu"
            value={formData.password}
            onChange={handleInputChange}
            disabled={loading}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50"
          />

          {!isLogin && (
            <input
              type="password"
              name="confirmPassword"
              placeholder="Xác nhận mật khẩu"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              disabled={loading}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all disabled:opacity-50"
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-lg font-bold hover:bg-secondary disabled:opacity-50 transition-all shadow-md-blue"
          >
            {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-600">
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              disabled={loading}
              className="ml-2 text-primary font-bold hover:text-secondary transition-all disabled:opacity-50"
            >
              {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-gray-600 text-sm mb-3">Bạn là quản trị viên?</p>
          <Link
            to="/admin/login"
            className="block w-full text-center py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-all font-medium"
          >
            Đăng nhập Admin Portal
          </Link>
        </div>
      </div>
    </div>
  );
}