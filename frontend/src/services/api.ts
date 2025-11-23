import axios from 'axios';
import { ApiResponse } from '../types';
import { config } from '../config';

// Create axios instance with default config
const api = axios.create({
  baseURL: config.apiBaseUrl, // Empty string in production, localhost URL in development
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API methods
export const apiClient = {
  // Health check
  healthCheck: async () => {
    const { data } = await api.get<ApiResponse>('/health');
    return data;
  },

  // Test endpoint
  testEndpoint: async (payload?: any) => {
    const { data } = await api.post<ApiResponse>('/api/test', payload);
    return data;
  },
};

export default api;
