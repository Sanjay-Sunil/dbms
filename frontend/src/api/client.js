import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const res = await axios.post('/api/auth/refresh/', { refresh });
          localStorage.setItem('access_token', res.data.access);
          original.headers.Authorization = `Bearer ${res.data.access}`;
          return api(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

/** Turn a DRF error response into one readable message. */
export function errorMessage(err, fallback = 'Something went wrong.') {
  const data = err?.response?.data;
  if (!data) return err?.message ? `${fallback} (${err.message})` : fallback;
  if (typeof data === 'string') return fallback;
  if (data.shortages) {
    return 'Insufficient stock:\n' + data.shortages
      .map((s) => `• ${s.ingredient}: need ${Number(s.required)} ${s.unit}, have ${Number(s.on_hand)}`)
      .join('\n');
  }
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  const first = Object.values(data).flat()[0];
  return typeof first === 'string' ? first : fallback;
}

// ── Auth ─────────────────────────────────────────
export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login/', { username, password }),
  register: (data) => api.post('/auth/register/', data),
  profile: () => api.get('/auth/profile/'),
  updateProfile: (data) => api.patch('/auth/profile/', data),
  listUsers: (role) =>
    api.get('/auth/users/', { params: role ? { role } : {} }),
};

// ── Food Points & Ingredients ───────────────────
export const foodPointAPI = {
  list: () => api.get('/food-points/'),
  detail: (id) => api.get(`/food-points/${id}/`),
};

export const ingredientAPI = {
  list: () => api.get('/ingredients/'),
};

// ── Menu ─────────────────────────────────────────
export const menuAPI = {
  list: (params) => api.get('/menu/', { params }),
  detail: (id) => api.get(`/menu/${id}/`),
  create: (data) => api.post('/menu/manage/', data),
  update: (id, data) => api.patch(`/menu/manage/${id}/`, data),
  delete: (id) => api.delete(`/menu/manage/${id}/`),
};

// ── Inventory ───────────────────────────────────
export const inventoryAPI = {
  list: (params) => api.get('/inventory/', { params }),
  addMovement: (data) => api.post('/inventory/movement/', data),
};

// ── Sales ───────────────────────────────────────
export const salesAPI = {
  list: (params) => api.get('/sales/', { params }),
  create: (data) => api.post('/sales/create/', data),
};

// ── Mess ────────────────────────────────────────
export const messAPI = {
  sessions: (params) => api.get('/mess/sessions/', { params }),
  sessionDetail: (id) => api.get(`/mess/sessions/${id}/`),
  createSession: (data) => api.post('/mess/sessions/create/', data),
  createRecord: (data) => api.post('/mess/records/create/', data),
  myHistory: () => api.get('/mess/my-history/'),
};

// ── Reports ─────────────────────────────────────
export const reportsAPI = {
  salesByFoodPoint: () => api.get('/reports/sales-by-food-point/'),
  lowStock: () => api.get('/reports/low-stock/'),
};
