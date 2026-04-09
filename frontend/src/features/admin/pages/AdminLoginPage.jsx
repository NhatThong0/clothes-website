import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@features/auth/hooks/useAuth';
import apiClient from '@features/shared/services/apiClient';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, adminUser, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });

  if (authLoading) return null;

  if (adminUser && adminUser.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.email.trim()) {
        setError('Vui lòng nhập email admin.');
        return;
      }

      if (!formData.password) {
        setError('Vui lòng nhập mật khẩu.');
        return;
      }

      const response = await apiClient.post('/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      if (response.data.status === 'success') {
        const userData = response.data.data.user;
        const token = response.data.data.token;

        if (userData.role !== 'admin') {
          setError('Tài khoản này không có quyền truy cập trang quản trị.');
          return;
        }

        login(userData, token);
        setFormData({ email: '', password: '' });
        navigate('/admin');
      } else {
        setError(response.data.message || 'Đăng nhập thất bại.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Đã xảy ra lỗi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0f0f10_0%,#1d1d1f_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-6 py-8 text-white backdrop-blur sm:px-10 sm:py-10 lg:px-14 lg:py-14">
          <div className="flex h-full flex-col justify-between gap-8">
            <div className="space-y-6">
              <div className="w-fit rounded-full border border-white/14 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-white/65">
                Trang đăng nhập dành cho admin
              </div>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-extrabold leading-[0.95] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                  Khu vực admin.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-white/70 sm:text-base lg:text-lg">
                  Màn hình này chỉ truy cập từ đường dẫn đăng nhập admin riêng tránh nhầm lẫn.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/6 px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Bảo mật</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/6 px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Tách biệt</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/6 px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Kiểm soát</p>
              </div>
            </div>
          </div>
        </section>

        <section className="editorial-card flex items-center rounded-[36px] px-6 py-8 sm:px-8 lg:px-10">
          <div className="w-full">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Đăng nhập admin</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-black">Đăng nhập vào dashboard</h2>
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-[22px] border border-black/10 bg-[#f7f7f4] px-4 py-3 text-sm text-slate-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block rounded-[24px] border border-black/8 bg-[#f7f7f4] px-5 py-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Email admin</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="admin@cuahang.com"
                  className="mt-2 w-full bg-transparent text-sm text-black outline-none placeholder:text-slate-400"
                  disabled={loading}
                />
              </label>

              <label className="block rounded-[24px] border border-black/8 bg-[#f7f7f4] px-5 py-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mật khẩu</span>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Nhập mật khẩu"
                  className="mt-2 w-full bg-transparent text-sm text-black outline-none placeholder:text-slate-400"
                  disabled={loading}
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-black px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập admin'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
