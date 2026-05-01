import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session expired or token rejected. Stash a marker so the Login page
      // can explain what happened (otherwise the page just silently swaps
      // out from under the user mid-action and looks like "save did nothing").
      // Also remember where they were so they can resume after re-login.
      const onLoginPage = window.location.pathname === '/login';
      if (!onLoginPage) {
        sessionStorage.setItem('gc_session_expired', '1');
        sessionStorage.setItem('gc_return_to', window.location.pathname + window.location.search);
      }
      localStorage.removeItem('gc_token');
      localStorage.removeItem('gc_user');
      if (!onLoginPage) window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
