import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import Loading from '@components/Loading';

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
