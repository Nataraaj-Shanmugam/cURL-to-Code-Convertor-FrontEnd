import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_CURL_CRAFT_API_URL || "http://127.0.0.1:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle new backend v2.0.0 error format: { success: false, error: { code, message, details } }
    const errorData = error.response?.data?.error;
    let message: string;

    if (errorData && typeof errorData === 'object') {
      message = errorData.message || "Request failed";
    } else if (typeof errorData === 'string') {
      message = errorData;
    } else {
      message = error.response?.data?.message || error.message || "Request failed";
    }

    return Promise.reject(new Error(message));
  }
);

export { API_BASE_URL };
