import { createContext, useState, useCallback, useEffect, useContext } from 'react';
import apiClient from '@features/shared/services/apiClient';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [adminUser, setAdminUser] = useState(null); // ✅ session admin riêng
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (storedUser && token) setUser(JSON.parse(storedUser));

      const storedAdmin = localStorage.getItem('adminUser');
      const adminToken = localStorage.getItem('adminToken');
      if (storedAdmin && adminToken) setAdminUser(JSON.parse(storedAdmin));
    } catch (err) {
      console.error('Error loading auth:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh user profile on app boot (includes loyalty tier fields).
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get('/user/profile');
        const fresh = res.data?.data;
        if (!cancelled && fresh && fresh._id) {
          setUser(fresh);
          localStorage.setItem('user', JSON.stringify(fresh));
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((userData, token) => {
    try {
      if (userData.role === 'admin') {
        // ✅ Admin login — lưu riêng, KHÔNG xóa user session
        setAdminUser(userData);
        localStorage.setItem('adminUser', JSON.stringify(userData));
        localStorage.setItem('adminToken', token);
      } else {
        // ✅ User login — lưu riêng, KHÔNG xóa admin session
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);

        // Non-blocking: fetch profile to enrich with loyalty/tier fields.
        apiClient
          .get('/user/profile')
          .then((res) => {
            const fresh = res.data?.data;
            if (fresh && fresh._id) {
              setUser(fresh);
              localStorage.setItem('user', JSON.stringify(fresh));
            }
          })
          .catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback((role) => {
    if (role === 'admin') {
      setAdminUser(null);
      localStorage.removeItem('adminUser');
      localStorage.removeItem('adminToken');
    } else {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  }, []);

  const updateProfile = useCallback((updatedUser) => {
    try {
      if (updatedUser.role === 'admin') {
        setAdminUser(updatedUser);
        localStorage.setItem('adminUser', JSON.stringify(updatedUser));
      } else {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = {
    user,          // user thường
    adminUser,     // user admin
    loading,
    login,
    logout,
    updateProfile,
    isAuthenticated: !!user,
    isAdminAuthenticated: !!adminUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
