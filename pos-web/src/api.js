import axios from 'axios';
import environment from './config/environment';

// API URL from environment configuration
// To change the URL, edit src/config/environment.js or set VITE_API_URL env variable
const API_URL = environment.API_URL;

const api = axios.create({
    baseURL: API_URL,
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 errors (redirect to login) - but not for login or verify-admin endpoints
api.interceptors.response.use( 
    (response) => response,
    (error) => {
        // Don't redirect for login or verify-admin endpoints - let them handle their own errors
        const isLoginEndpoint = error.config?.url?.includes('/auth/login');
        const isVerifyAdmin = error.config?.url?.includes('verify-admin');
        
        if (error.response?.status === 401 && !isVerifyAdmin && !isLoginEndpoint) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
export { API_URL };