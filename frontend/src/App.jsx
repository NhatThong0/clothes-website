import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@context/AuthContext';
import { CartProvider } from '@context/CartContext';
import { ProductProvider } from '@context/ProductContext';
import { AdminProvider } from '@context/AdminContext';
import { useAuth } from '@hooks/useAuth';

// Layouts
import MainLayout from '@layouts/MainLayout';
import ProtectedLayout from '@layouts/ProtectedLayout';
import AdminLayout from '@layouts/AdminLayout';

// Pages
import HomePage from '@pages/HomePage';
import ProductListPage from '@pages/ProductListPage';
import ProductDetailPage from '@pages/ProductDetailPage';
import CartPage from '@pages/CartPage';
import CheckoutPage from '@pages/CheckoutPage';
import AuthPage from '@pages/AuthPage';
import AdminLoginPage from '@pages/AdminLoginPage';
import ProfilePage from '@pages/ProfilePage';
import OrdersPage from '@pages/OrdersPage';
import OrderDetailPage from '@pages/OrderDetailPage';
import PaymentResultPage from '@pages/PaymentResultPage'; // ✅ thêm

// Admin Pages
import AdminDashboard from '@pages/AdminDashboard';
import AdminProductManagement from '@pages/AdminProductManagement';
import AdminCategoryManagement from '@pages/AdminCategoryManagement';
import AdminOrderManagement from '@pages/AdminOrderManagement';
import AdminOrderDetail from '@pages/AdminOrderDetail';
import AdminUserManagement from '@pages/AdminUserManagement';
import AdminReviewManagement from '@pages/AdminReviewManagement';
import AdminVoucherManagement from '@pages/AdminVoucherManagement';
import AdminBannerManagement from '@pages/AdminBannerManagement';
import AdminInventoryManagement from '@pages/AdminInventoryManagement';
import ChatWidget from '@components/ChatWidget';
import AdminChat from '@pages/AdminChat';
import AdminAiChat from '@pages/AdminAiChat';

function ProtectedAdminRoute({ children }) {
  const { adminUser, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;
  if (!adminUser || adminUser.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return children;
}

function AppRoutes() {
  
  return (
    <>
      <Routes>
        {/* Main routes */}
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/products" element={<ProductListPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
        </Route>

        {/* Auth routes */}
        <Route path="auth/login" element={<AuthPage />} />
        <Route path="auth/register" element={<AuthPage />} />
        <Route path="admin/login" element={<AdminLoginPage />} />

        {/* ✅ VNPay return — không cần auth, không cần layout */}
        <Route path="payment-result" element={<PaymentResultPage />} />

        {/* Protected user routes */}
        <Route element={<ProtectedLayout />}>
          <Route element={<MainLayout />}>
            <Route path="profile" element={<ProfilePage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route element={
          <ProtectedAdminRoute>
            <AdminLayout />
          </ProtectedAdminRoute>
        }>
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/products" element={<AdminProductManagement />} />
          <Route path="admin/categories" element={<AdminCategoryManagement />} />
          <Route path="admin/orders" element={<AdminOrderManagement />} />
          <Route path="admin/orders/:id" element={<AdminOrderDetail />} />
          <Route path="admin/users" element={<AdminUserManagement />} />
          <Route path="admin/reviews" element={<AdminReviewManagement />} />
          <Route path="admin/vouchers" element={<AdminVoucherManagement />} />
          <Route path="/admin/banners" element={<AdminBannerManagement />} />
          <Route path="/admin/inventory" element={<AdminInventoryManagement />} />
          <Route path="/admin/chat" element={<AdminChat />} />
          <Route path="/admin/ai-chat" element={<AdminAiChat />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatWidget />
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <ProductProvider>
            <AdminProvider>
              <AppRoutes />
            </AdminProvider>
          </ProductProvider>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;