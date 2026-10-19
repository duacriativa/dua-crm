import axios from 'axios';
import { refreshAccessToken, endSession } from './auth-fetch';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

// Injeta access token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh token automático quando access token expira (401)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      endSession();
    }

    return Promise.reject(error);
  },
);

export default api;
