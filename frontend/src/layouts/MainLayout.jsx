import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom'; // 👈 thêm useLocation
import Header from '@components/Header';
import Footer from '@components/Footer';

export default function MainLayout() {
  const location = useLocation(); // 👈 thêm

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]); // 👈 chạy mỗi khi đổi route

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}