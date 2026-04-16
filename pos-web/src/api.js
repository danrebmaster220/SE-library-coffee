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
        const status = error.response?.status;
        const errorCode = error.response?.data?.code;
        const requestUrl = String(error.config?.url || '');

        if (status === 428 && errorCode === 'MUST_CHANGE_PASSWORD' && !requestUrl.includes('/users/me/password')) {
            const rawUser = localStorage.getItem('user');
            if (rawUser) {
                try {
                    const user = JSON.parse(rawUser);
                    localStorage.setItem('user', JSON.stringify({
                        ...user,
                        mustChangePassword: true
                    }));
                } catch {
                    // Ignore malformed local storage payload.
                }
            }

            if (window.location.pathname !== '/force-password-change') {
                window.location.href = '/force-password-change';
            }
        }

        // Don't redirect for login or verify-admin endpoints - let them handle their own errors
        const isLoginEndpoint = requestUrl.includes('/auth/login');
        const isVerifyAdmin = requestUrl.includes('verify-admin');
        const isPasswordChangeEndpoint = requestUrl.includes('/users/me/password');
        
        if (error.response?.status === 401 && !isVerifyAdmin && !isLoginEndpoint && !isPasswordChangeEndpoint) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
export { API_URL };