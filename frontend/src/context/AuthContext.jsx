import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            // We assume token is valid or we check it via an API call
            // The backend has /api/auth/user/get (from checking auth.route.js earlier)
            // Let's verify.
            try {
                const res = await api.post('/auth/user/get');
                if (res.data.status === 'true') {
                    setUser(res.data.data);
                } else {
                    logout();
                }
            } catch (e) {
                logout();
            }
        }
        setLoading(false);
    };

    const login = async (email, password) => {
        try {
            const res = await api.post('/auth/login', { email, password });
            // Backend returns status as string 'true', 'mfa', or 'hardwarekey'
            if (res.data.status === 'true' || res.data.status === 'mfa' || res.data.status === 'hardwarekey') {
                // Start with simple login flow, ignoring MFA for now unless strictly required
                // The backend response for simple login includes `token` and `data`
                if (res.data.token) {
                    localStorage.setItem('token', res.data.token);
                    localStorage.setItem('user', JSON.stringify(res.data.data));
                    setUser(res.data.data);
                    return { success: true };
                }
            }
            return { success: false, message: res.data.message };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Login failed' };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
