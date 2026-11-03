import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 4000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request Interceptor: Attach Auth Token or Session
api.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Format errors and handle connectivity
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (!error.response) {
      console.warn('[Axios API] Server backend offline / tidak merespons. Menggunakan mode demonstrasi lokal.');
    }
    return Promise.reject(error);
  }
);

export default api;