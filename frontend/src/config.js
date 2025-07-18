// Configuration for different environments
const config = {
  development: {
    API_BASE_URL: 'http://localhost:3001/api'
  },
  production: {
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'https://your-backend-url.com/api'
  }
};

// Get current environment
const environment = process.env.NODE_ENV || 'development';

// Export the appropriate configuration
export const API_BASE_URL = config[environment].API_BASE_URL; 