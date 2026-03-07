import { createContext, useState, useCallback, useEffect, useContext } from 'react';

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
      }
      return true;
    } catch (err) {
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
    } catch (err) {
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