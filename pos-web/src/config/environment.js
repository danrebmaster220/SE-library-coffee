// config/environment.js
// Environment configuration for POS Web Application
// 
// This file centralizes all environment-specific settings.
// For production deployment, update the 'production' values below.

const ENV = {
  // Development - Local development on your machine
  development: {
    API_URL: 'http://localhost:3000/api',
    SOCKET_URL: 'http://localhost:3000',
    ENV_NAME: 'development',
  },
  
  // Production - For deployed/hosted application
  production: {
    // Update these URLs when you deploy your backend
    // Example: API_URL: 'https://your-backend.railway.app/api',
    // Example: SOCKET_URL: 'https://your-backend.railway.app',
    API_URL: 'http://localhost:3000/api',
    SOCKET_URL: 'http://localhost:3000',
    ENV_NAME: 'production',
  },
};

// ===========================================
// ENVIRONMENT DETECTION
// ===========================================
// Vite automatically sets import.meta.env.MODE to 'development' or 'production'
// You can also use import.meta.env.VITE_* variables for more control

const getEnvironment = () => {
  // Check for Vite environment variables first
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // If VITE_API_URL is set, use it (allows override via .env files)
    if (import.meta.env.VITE_API_URL) {
      const baseUrl = import.meta.env.VITE_API_URL;
      return {
        API_URL: baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`,
        SOCKET_URL: baseUrl.replace('/api', '').replace(/\/$/, ''),
        ENV_NAME: import.meta.env.MODE || 'production',
      };
    }
    
    // Otherwise, use the MODE to select environment
    const mode = import.meta.env.MODE || 'development';
    return ENV[mode] || ENV.development;
  }
  
  // Fallback to development
  return ENV.development;
};

const environment = getEnvironment();

// Log current environment on startup (only in development)
if (environment.ENV_NAME === 'development') {
  console.log(`🔌 POS-Web connecting to: ${environment.API_URL} (${environment.ENV_NAME})`);
}

export default environment;
export { ENV };
