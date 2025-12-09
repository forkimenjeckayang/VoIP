import axios from 'axios';

// Use environment variable if set, otherwise use Vite proxy (/api)
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            // Backend expects 'token' header, not 'Authorization'
            config.headers['token'] = token;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
