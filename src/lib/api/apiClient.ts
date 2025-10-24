// CONSOLIDATED API CLIENT
import axios from "axios";

// Single source of truth for API configuration
const API_BASE_URL = "http://127.0.0.1:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if needed in the future
    // const token = localStorage.getItem('token');
    // if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with better error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = 
      error.response?.data?.message || 
      error.response?.data?.error ||
      error.message || 
      "Request failed";
    return Promise.reject(new Error(message));
  }
);

// Export base URL for reference if needed
export { API_BASE_URL };