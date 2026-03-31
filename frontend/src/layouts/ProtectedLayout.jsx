import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@features/auth/hooks/useAuth';
import Loading from '@components/common/Loading';

export default function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return <Outlet />;
}
