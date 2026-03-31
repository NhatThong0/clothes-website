import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@context/AuthContext';
import { CartProvider } from '@context/CartContext';
import { ProductProvider } from '@context/ProductContext';
import { AdminProvider } from '@context/AdminContext';
import { useAuth } from '@features/auth/hooks/useAuth';

import MainLayout from '@layouts/MainLayout';
import ProtectedLayout from '@layouts/ProtectedLayout';
import AdminLayout from '@layouts/AdminLayout';

import HomePage from '@features/product/pages/HomePage';
import ProductListPage from '@features/product/pages/ProductListPage';
import ProductDetailPage from '@features/product/pages/ProductDetailPage';
import CartPage from '@features/cart/pages/CartPage';
import CheckoutPage from '@features/cart/pages/CheckoutPage';
import AuthPage from '@features/auth/pages/AuthPage';
import ProfilePage from '@features/auth/pages/ProfilePage';
import OrdersPage from '@features/order/pages/OrdersPage';
import OrderDetailPage from '@features/order/pages/OrderDetailPage';
import PaymentResultPage from '@features/payment/pages/PaymentResultPage';
import ChatWidget from '@features/chat/components/ChatWidget';

const AdminLoginPage = lazy(() => import('@features/admin/pages/AdminLoginPage'));
const AdminDashboard = lazy(() => import('@features/admin/pages/AdminDashboard'));
const AdminProductManagement = lazy(() => import('@features/admin/pages/AdminProductManagement'));
const AdminCategoryManagement = lazy(() => import('@features/admin/pages/AdminCategoryManagement'));
const AdminOrderManagement = lazy(() => import('@features/admin/pages/AdminOrderManagement'));
const AdminOrderDetail = lazy(() => import('@features/admin/pages/AdminOrderDetail'));
const AdminUserManagement = lazy(() => import('@features/admin/pages/AdminUserManagement'));
const AdminReviewManagement = lazy(() => import('@features/admin/pages/AdminReviewManagement'));
const AdminVoucherManagement = lazy(() => import('@features/admin/pages/AdminVoucherManagement'));
const AdminBannerManagement = lazy(() => import('@features/admin/pages/AdminBannerManagement'));
const AdminInventoryManagement = lazy(() => import('@features/admin/pages/AdminInventoryManagement'));
const AdminChat = lazy(() => import('@features/chat/pages/AdminChat'));
const AdminAiChat = lazy(() => import('@features/chat/pages/AdminAiChat'));

function RouteLoader() {
  return <div className="min-h-screen flex items-center justify-center">Dang tai...</div>;
}

function ProtectedAdminRoute({ children }) {
  const { adminUser, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Dang tai...</div>;
  }

  if (!adminUser || adminUser.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/products" element={<ProductListPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
          </Route>

          <Route path="auth/login" element={<AuthPage />} />
          <Route path="auth/register" element={<AuthPage />} />
          <Route path="admin/login" element={<AdminLoginPage />} />
          <Route path="payment-result" element={<PaymentResultPage />} />

          <Route element={<ProtectedLayout />}>
            <Route element={<MainLayout />}>
              <Route path="profile" element={<ProfilePage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
            </Route>
          </Route>

          <Route
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
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
