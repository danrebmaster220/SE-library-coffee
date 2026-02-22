// config/environment.js
// Environment configuration for Kiosk Application
//
// This file centralizes all environment-specific settings.
// For production deployment, update the 'production' values below.

const ENV = {
  // Development - Local network (for testing on same WiFi)
  development: {
    // Change this to your computer's local IP address
    // Find it by running 'ipconfig' in terminal (look for IPv4 Address)
    // Example: 192.168.1.100, 192.168.0.50, etc.
    API_URL: 'http://192.168.1.11:3000/api',
    ENV_NAME: 'development',
  },
  
  // Production - Update these when deploying to cloud
  production: {
    // Option 1: Local network (in-store kiosk on same network as backend)
    // API_URL: 'http://192.168.1.100:3000/api',
    
    // Option 2: Cloud hosted backend
    // API_URL: 'https://your-backend.railway.app/api',
    // API_URL: 'https://your-backend.render.com/api',
    
    // Current setting (update when you deploy):
    API_URL: 'https://library-coffee-api.onrender.com/api',
    ENV_NAME: 'production',
  },
};

// ===========================================
// CHANGE THIS TO SWITCH ENVIRONMENTS
// ===========================================
const CURRENT_ENV = 'production';
// Options: 'development' | 'production'
// ===========================================

const getEnvVars = () => {
  return ENV[CURRENT_ENV] || ENV.development;
};

export default getEnvVars();
export { ENV, CURRENT_ENV };
