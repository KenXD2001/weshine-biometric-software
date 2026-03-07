
// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL;

// Use the base URL directly since our backend already has /api in the routes
export const API_URL = API_BASE_URL;

// App Configuration
export const APP_NAME = import.meta.env.VITE_APP_NAME;
export const APP_VERSION = import.meta.env.VITE_APP_VERSION;
export const APP_ENVIRONMENT = import.meta.env.VITE_APP_ENVIRONMENT;

// Legacy API URL (for backward compatibility)
// export const API_URL = "http://"+window.location.hostname+":8084/sb-biometric";
