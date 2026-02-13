// config/environment.js
// Environment configuration for easy switching between development and production

const ENV = {
  // Development - Local network (for testing on same WiFi)
  development: {
    // Change this to your computer's local IP address
    // Find it by running 'ipconfig' in terminal (look for IPv4 Address)
    API_URL: 'http://192.168.1.11:3000/api',
    ENV_NAME: 'development',
  },
  
  // Production - For in-store kiosk tablets on same network
  // Use the same local IP or a static IP assigned to your backend server
  production: {
    // Option 1: Local network (in-store kiosk)
    API_URL: 'http://192.168.1.11:3000/api',
    
    // Option 2: If you later host on cloud, change to:
    // API_URL: 'https://api.yourdomain.com/api',
    
    ENV_NAME: 'production',
  },
};

// ===========================================
// CHANGE THIS TO SWITCH ENVIRONMENTS
// ===========================================
const CURRENT_ENV = 'development';
// Options: 'development' | 'production'
// ===========================================

const getEnvVars = () => {
  return ENV[CURRENT_ENV] || ENV.development;
};

export default getEnvVars();
export { ENV, CURRENT_ENV };
