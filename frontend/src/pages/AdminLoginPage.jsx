import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import apiClient from '@services/apiClient';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, adminUser, loading: authLoading } = useAuth(); // ✅ dùng adminUser

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });

  if (authLoading) return null;

  // ✅ Check adminUser thay vì user
  if (adminUser && adminUser.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

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
      if (!formData.email) { setError('Vui lòng nhập email'); return; }
      if (!formData.password) { setError('Vui lòng nhập mật khẩu'); return; }

      const response = await apiClient.post('/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      if (response.data.status === 'success') {
        const userData = response.data.data.user;
        const token = response.data.data.token;

        if (userData.role !== 'admin') {
          setError('Bạn không có quyền truy cập admin dashboard');
          return;
        }

        // ✅ login() sẽ tự detect role=admin và lưu vào adminToken/adminUser
        login(userData, token);
        setFormData({ email: '', password: '' });
        navigate('/admin');
      } else {
        setError(response.data.message || 'Đăng nhập thất bại');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Đã có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-3xl">⚙️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 text-sm mt-2">Đăng nhập tài khoản quản trị</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm font-medium flex items-center gap-2">
              <span>⚠️</span>
              {error}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="admin@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
              disabled={loading}
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Nhập mật khẩu"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
          </button>
        </form>

        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs font-medium text-blue-900 mb-2">📝 Tài khoản demo:</p>
          <p className="text-xs text-blue-800 font-mono">Email: admin@example.com</p>
          <p className="text-xs text-blue-800 font-mono">Mật khẩu: admin123</p>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Không phải admin?{' '}
            <Link to="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold">
              Đăng nhập khách hàng
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
