const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  signup(payload) {
    return request('/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
  },
  login(payload) {
    return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  },

  listCategories(token) {
    return request('/categories', { token });
  },
  createCategory(payload, token) {
    return request('/categories', { method: 'POST', body: JSON.stringify(payload), token });
  },
  deleteCategory(id, token) {
    return request(`/categories/${id}`, { method: 'DELETE', token });
  },

  listTransactions(params, token) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, String(v));
    }
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/transactions${query}`, { token });
  },
  createTransaction(payload, token) {
    return request('/transactions', { method: 'POST', body: JSON.stringify(payload), token });
  },
  updateTransaction(id, payload, token) {
    return request(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(payload), token });
  },
  deleteTransaction(id, token) {
    return request(`/transactions/${id}`, { method: 'DELETE', token });
  },

  monthlySummary(year, month, token) {
    const qs = new URLSearchParams({ year: String(year), month: String(month) });
    return request(`/transactions/summary/monthly?${qs.toString()}`, { token });
  },

  getBudget(year, month, token) {
    const qs = new URLSearchParams({ year: String(year), month: String(month) });
    return request(`/budgets?${qs.toString()}`, { token });
  },
  upsertBudget(payload, token) {
    return request('/budgets', { method: 'PUT', body: JSON.stringify(payload), token });
  },
};
