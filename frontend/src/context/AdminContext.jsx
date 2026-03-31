import React, { createContext, useState, useCallback } from 'react';
import apiClient from '@features/shared/services/apiClient';

export const AdminContext = createContext();

export const AdminProvider = ({ children }) => {
    const [dashboardStats, setDashboardStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Dashboard
    const fetchDashboardStats = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get('/admin/dashboard/stats');
            setDashboardStats(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch dashboard stats');
            console.error('Dashboard stats error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Products
    const fetchAdminProducts = useCallback(async (params = {}) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get('/admin/products', { params });
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch products');
            console.error('Fetch products error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const createProduct = useCallback(async (productData) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.post('/admin/products', productData);
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create product');
            console.error('Create product error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateProduct = useCallback(async (productId, productData) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.put(`/admin/products/${productId}`, productData);
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update product');
            console.error('Update product error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const toggleProductStatus = useCallback(async (productId) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.put(`/admin/products/${productId}/toggle-status`);
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to toggle product status');
            console.error('Toggle status error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteProduct = useCallback(async (productId) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.delete(`/admin/products/${productId}`);
            return response.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete product');
            console.error('Delete product error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Categories
    const fetchCategories = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get('/admin/categories');
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch categories');
            console.error('Fetch categories error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const createCategory = useCallback(async (categoryData) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.post('/admin/categories', categoryData);
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create category');
            console.error('Create category error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateCategory = useCallback(async (categoryId, categoryData) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.put(`/admin/categories/${categoryId}`, categoryData);
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update category');
            console.error('Update category error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteCategory = useCallback(async (categoryId) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.delete(`/admin/categories/${categoryId}`);
            return response.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete category');
            console.error('Delete category error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Orders
    const fetchAdminOrders = useCallback(async (params = {}) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get('/admin/orders', { params });
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch orders');
            console.error('Fetch orders error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const getOrderDetails = useCallback(async (orderId) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get(`/admin/orders/${orderId}`);
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch order details');
            console.error('Get order details error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateOrderStatus = useCallback(async (orderId, statusData) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.put(`/admin/orders/${orderId}/status`, statusData);
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update order status');
            console.error('Update order status error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Users
    const fetchAdminUsers = useCallback(async (params = {}) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get('/admin/users', { params });
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch users');
            console.error('Fetch users error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateUserRole = useCallback(async (userId, roleData) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.put(`/admin/users/${userId}/role`, roleData);
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update user role');
            console.error('Update user role error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUserOrderHistory = useCallback(async (userId, params = {}) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get(`/admin/users/${userId}/orders`, { params });
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch user order history');
            console.error('Fetch user order history error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Reviews
    const fetchReviews = useCallback(async (params = {}) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get('/admin/reviews', { params });
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch reviews');
            console.error('Fetch reviews error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteReview = useCallback(async (productId, reviewId) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.delete(`/admin/reviews/${productId}/${reviewId}`);
            return response.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete review');
            console.error('Delete review error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);
    const toggleReviewVisibility = useCallback(async (productId, reviewId) => {
    try {
        setLoading(true);
        setError(null);
        const response = await apiClient.put(`/admin/reviews/${productId}/${reviewId}/toggle`);
        return response.data.data;
    } catch (err) {
        setError(err.response?.data?.message || 'Failed to toggle review visibility');
        console.error('Toggle review error:', err);
        throw err;
    } finally {
        setLoading(false);
    }
}, []);

    // Vouchers
    const fetchVouchers = useCallback(async (params = {}) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get('/admin/vouchers', { params });
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch vouchers');
            console.error('Fetch vouchers error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const createVoucher = useCallback(async (voucherData) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.post('/admin/vouchers', voucherData);
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create voucher');
            console.error('Create voucher error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateVoucher = useCallback(async (voucherId, voucherData) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.put(`/admin/vouchers/${voucherId}`, voucherData);
            return response.data.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update voucher');
            console.error('Update voucher error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteVoucher = useCallback(async (voucherId) => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.delete(`/admin/vouchers/${voucherId}`);
            return response.data;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete voucher');
            console.error('Delete voucher error:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const value = {
        // State
        dashboardStats,
        loading,
        error,
        setError,

        // Dashboard
        fetchDashboardStats,

        // Products
        fetchAdminProducts,
        createProduct,
        updateProduct,
        toggleProductStatus,
        deleteProduct,

        // Categories
        fetchCategories,
        createCategory,
        updateCategory,
        deleteCategory,

        // Orders
        fetchAdminOrders,
        getOrderDetails,
        updateOrderStatus,

        // Users
        fetchAdminUsers,
        updateUserRole,
        fetchUserOrderHistory,

        // Reviews
        fetchReviews,
        deleteReview,
        toggleReviewVisibility,

        // Vouchers
        fetchVouchers,
        createVoucher,
        updateVoucher,
        deleteVoucher,
    };

    return (
        <AdminContext.Provider value={value}>
            {children}
        </AdminContext.Provider>
    );
};
