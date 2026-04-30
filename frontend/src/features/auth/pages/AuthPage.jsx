import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@features/auth/hooks/useAuth';
import apiClient from '@features/shared/services/apiClient';
import { validateEmail, validatePassword } from '@utils/helpers';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const facebookAppId = import.meta.env.VITE_FACEBOOK_APP_ID;

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.id = id;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function AuthFeature({ title, description }) {
  return (
    <div className="editorial-panel rounded-[24px] px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Lợi ích</p>
      <h3 className="mt-2 text-lg font-bold tracking-[-0.03em] text-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, loading: authLoading } = useAuth();

  const isLogin = useMemo(() => !location.pathname.includes('/register'), [location.pathname]);
  const from = location.state?.from || '/';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    otp: '',
  });
  const [otpStep, setOtpStep] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');

  useEffect(() => {
    setError('');
    setOtpStep(false);
    setFormData({ email: '', password: '', confirmPassword: '', fullName: '', otp: '' });
  }, [isLogin]);

  if (!authLoading && user) {
    return <Navigate to={from} replace />;
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const switchPath = isLogin ? '/auth/register' : '/auth/login';

  const completeAuth = (userData, token) => {
    if (userData.role === 'admin') {
      setError('Tài khoản này cần đăng nhập tại đường dẫn admin riêng.');
      return;
    }

    login(userData, token);
    navigate(from, { replace: true });
  };

  const submitSocialToken = async (provider, { accessToken, idToken }) => {
    const response = await apiClient.post('/auth/social-login', {
      provider,
      accessToken,
      idToken,
    });

    if (response.data.status === 'success') {
      completeAuth(response.data.data.user, response.data.data.token);
    } else {
      setError(response.data.message || 'Đăng nhập mạng xã hội thất bại.');
    }
  };

  const handleGoogleLogin = async () => {
    if (!googleClientId) {
      setError('Thiếu VITE_GOOGLE_CLIENT_ID trong frontend/.env.');
      return;
    }

    setError('');
    setSocialLoading('google');

    try {
      await loadScript('https://accounts.google.com/gsi/client', 'google-gsi-client');
      // Prefer ID token (credential) so backend can verify locally.
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (credentialResponse) => {
            try {
              if (!credentialResponse?.credential) {
                setError('Không lấy được idToken Google.');
                return;
              }
              await submitSocialToken('google', { idToken: credentialResponse.credential });
            } catch (err) {
              setError(err.response?.data?.message || err.message || 'Đăng nhập Google thất bại.');
            } finally {
              setSocialLoading('');
            }
          },
        });

        window.google.accounts.id.prompt((notification) => {
          // If One Tap is not displayed (blocked), fall back to OAuth access token.
          const notDisplayed = notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.();
          if (!notDisplayed) return;

          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: googleClientId,
            scope: 'openid email profile',
            callback: async (tokenResponse) => {
              try {
                if (!tokenResponse?.access_token) {
                  setError('Không lấy được token Google.');
                  return;
                }
                await submitSocialToken('google', { accessToken: tokenResponse.access_token });
              } catch (err) {
                setError(err.response?.data?.message || err.message || 'Đăng nhập Google thất bại.');
              } finally {
                setSocialLoading('');
              }
            },
            error_callback: () => {
              setError('Bạn đã hủy đăng nhập Google.');
              setSocialLoading('');
            },
          });
          tokenClient.requestAccessToken();
        });
      } else {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'openid email profile',
          callback: async (tokenResponse) => {
            try {
              if (!tokenResponse?.access_token) {
                setError('Không lấy được token Google.');
                return;
              }
              await submitSocialToken('google', { accessToken: tokenResponse.access_token });
            } catch (err) {
              setError(err.response?.data?.message || err.message || 'Đăng nhập Google thất bại.');
            } finally {
              setSocialLoading('');
            }
          },
          error_callback: () => {
            setError('Bạn đã hủy đăng nhập Google.');
            setSocialLoading('');
          },
        });
        tokenClient.requestAccessToken();
      }
    } catch (err) {
      setSocialLoading('');
      setError(err.message || 'Không tải được Google Login.');
    }
  };

  const handleFacebookLogin = async () => {
    if (!facebookAppId) {
      setError('Thiếu VITE_FACEBOOK_APP_ID trong frontend/.env.');
      return;
    }

    setError('');
    setSocialLoading('facebook');

    try {
      await loadScript('https://connect.facebook.net/en_US/sdk.js', 'facebook-jssdk');
      window.FB.init({
        appId: facebookAppId,
        cookie: true,
        xfbml: false,
        version: 'v19.0',
      });

      window.FB.login(
        async (response) => {
          try {
            if (!response.authResponse?.accessToken) {
              setError('Bạn đã hủy đăng nhập Facebook.');
              return;
            }
            await submitSocialToken('facebook', { accessToken: response.authResponse.accessToken });
          } catch (err) {
            setError(err.response?.data?.message || err.message || 'Đăng nhập Facebook thất bại.');
          } finally {
            setSocialLoading('');
          }
        },
        { scope: 'email,public_profile' },
      );
    } catch (err) {
      setSocialLoading('');
      setError(err.message || 'Không tải được Facebook Login.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (otpStep) {
        if (!formData.otp.trim()) {
          setError('Vui lòng nhập mã OTP.');
          return;
        }

        const response = await apiClient.post('/auth/register/verify-otp', {
          email: formData.email,
          otp: formData.otp,
        });

        if (response.data.status === 'success') {
          completeAuth(response.data.data.user, response.data.data.token);
        } else {
          setError(response.data.message || 'Xác nhận OTP thất bại.');
        }
        return;
      }

      if (!validateEmail(formData.email)) {
        setError('Vui lòng nhập email hợp lệ.');
        return;
      }

      if (!formData.password) {
        setError('Vui lòng nhập mật khẩu.');
        return;
      }

      if (isLogin) {
        const response = await apiClient.post('/auth/login', {
          email: formData.email,
          password: formData.password,
        });

        if (response.data.status === 'success') {
          const userData = response.data.data.user;
          const token = response.data.data.token;

          if (userData.role === 'admin') {
            setError('Tài khoản này cần đăng nhập tại đường dẫn admin riêng.');
            return;
          }

          completeAuth(userData, token);
        } else {
          setError(response.data.message || 'Đăng nhập thất bại.');
        }
      } else {
        if (!formData.fullName.trim()) {
          setError('Vui lòng nhập họ và tên.');
          return;
        }

        if (!validatePassword(formData.password)) {
          setError('Mật khẩu phải có ít nhất 6 ký tự.');
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          setError('Xác nhận mật khẩu không khớp.');
          return;
        }

        const response = await apiClient.post('/auth/register', {
          name: formData.fullName,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        });

        if (response.data.status === 'success') {
          setOtpStep(true);
          setError('Mã OTP đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư.');
        } else {
          setError(response.data.message || 'Đăng ký thất bại.');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Đã xảy ra lỗi.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/auth/register', {
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      if (response.data.status === 'success') {
        setError('Mã OTP mới đã được gửi tới email của bạn.');
      } else {
        setError(response.data.message || 'Không gửi lại được OTP.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không gửi lại được OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f3_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="editorial-card editorial-grid relative overflow-hidden rounded-[36px] px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-14">
          <div className="absolute right-10 top-10 hidden h-44 w-44 rounded-full bg-black/[0.05] blur-3xl lg:block" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="space-y-6">
              <div className="w-fit rounded-full border border-black/10 bg-[#f4f4f1] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-500">
                KHÁCH HÀNG
              </div>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-extrabold leading-[0.95] tracking-[-0.05em] text-black sm:text-5xl lg:text-6xl">
                  {isLogin ? 'Chào mừng bạn !' : otpStep ? 'Xác nhận email' : 'Tạo tài khoản mới'}
                </h1>
                <p className="max-w-xl text-sm leading-7 text-slate-500 sm:text-base lg:text-lg">
                  {isLogin
                    ? 'Đăng nhập vào tài khoản của bạn để truy cập lịch sử đơn hàng, quản lý thông tin và trải nghiệm mua sắm được cá nhân hóa.'
                    : otpStep
                      ? 'Nhập mã OTP đã gửi đến email để hoàn tất đăng ký tài khoản của bạn.'
                    : 'Tạo tài khoản mới để lưu thông tin, theo dõi đơn hàng và tận hưởng trải nghiệm mua sắm được cải thiện.'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <AuthFeature title="Thanh toán nhanh" description="Thông tin tài khoản được lưu lại giúp giỏ hàng và thanh toán nhanh hơn ở những lần quay lại." />
              <AuthFeature title="Lịch sử đơn hàng" description="Theo dõi đơn mua, tiến độ giao hàng và hoạt động gần đây trong một khu vực tài khoản gọn gàng." />
              <AuthFeature title="Trãi nghiệm tốt hơn" description="Trải nghiệm mua sắm được cải thiện với giao diện tối giản." />
            </div>
          </div>
        </section>

        <section className="editorial-card flex items-center rounded-[36px] px-6 py-8 sm:px-8 lg:px-10">
          <div className="w-full">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  {isLogin ? 'Đăng nhập' : 'Đăng ký'}
                </p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-black">
                  {isLogin ? 'Truy cập tài khoản của bạn' : otpStep ? 'Nhập mã OTP' : 'Tạo tài khoản mới'}
                </h2>
              </div>
              <Link to="/" className="text-sm font-semibold text-slate-500 transition hover:text-black">
                Quay lại cửa hàng
              </Link>
            </div>

            {error && (
              <div className="mb-6 rounded-[22px] border border-black/10 bg-[#f7f7f4] px-4 py-3 text-sm text-slate-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && !otpStep && (
                <label className="block rounded-[24px] border border-black/8 bg-[#f7f7f4] px-5 py-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Họ và tên</span>
                  <input
                    type="text"
                    name="fullName"
                    placeholder="Nguyen Van A"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="mt-2 w-full bg-transparent text-sm text-black outline-none placeholder:text-slate-400"
                  />
                </label>
              )}

              <label className="block rounded-[24px] border border-black/8 bg-[#f7f7f4] px-5 py-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="name@email.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="mt-2 w-full bg-transparent text-sm text-black outline-none placeholder:text-slate-400"
                />
              </label>

              {!otpStep && (
                <label className="block rounded-[24px] border border-black/8 bg-[#f7f7f4] px-5 py-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mật khẩu</span>
                <input
                  type="password"
                  name="password"
                  placeholder="Nhập mật khẩu"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="mt-2 w-full bg-transparent text-sm text-black outline-none placeholder:text-slate-400"
                />
                </label>
              )}

              {!isLogin && !otpStep && (
                <label className="block rounded-[24px] border border-black/8 bg-[#f7f7f4] px-5 py-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Xác nhận mật khẩu</span>
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Nhập lại mật khẩu"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="mt-2 w-full bg-transparent text-sm text-black outline-none placeholder:text-slate-400"
                  />
                </label>
              )}

              {otpStep && (
                <label className="block rounded-[24px] border border-black/8 bg-[#f7f7f4] px-5 py-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mã OTP</span>
                  <input
                    type="text"
                    name="otp"
                    placeholder="Nhập 6 số"
                    value={formData.otp}
                    onChange={handleInputChange}
                    disabled={loading}
                    inputMode="numeric"
                    maxLength={6}
                    className="mt-2 w-full bg-transparent text-sm text-black outline-none placeholder:text-slate-400"
                  />
                </label>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-black px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : otpStep ? 'Xác nhận email' : 'Gửi mã OTP'}
              </button>

              {otpStep && (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="w-full rounded-full border border-black/10 px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Gửi lại mã OTP
                </button>
              )}
            </form>

            {isLogin && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <span className="h-px flex-1 bg-black/8" />
                  Hoặc đăng nhập bằng
                  <span className="h-px flex-1 bg-black/8" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading || Boolean(socialLoading)}
                    className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {socialLoading === 'google' ? 'Đang mở Google...' : 'Google'}
                  </button>
                  <button
                    type="button"
                    onClick={handleFacebookLogin}
                    disabled={loading || Boolean(socialLoading)}
                    className="rounded-full border border-black/10 bg-[#1877f2] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#166fe5] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {socialLoading === 'facebook' ? 'Đang mở Facebook...' : 'Facebook'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-black/6 pt-6 text-sm text-slate-500 text-center">
              {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
              <Link to={switchPath} state={{ from }} className="font-semibold text-black transition hover:text-slate-600">
                {isLogin ? 'Đăng ký ngay' : 'Đăng nhập ngay'}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
