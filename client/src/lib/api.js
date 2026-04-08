const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
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
  listCategories() {
    return request('/categories');
  },
  createCategory(payload) {
    return request('/categories', { method: 'POST', body: JSON.stringify(payload) });
  },
  deleteCategory(id) {
    return request(`/categories/${id}`, { method: 'DELETE' });
  },

  listTransactions(params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, String(v));
    }
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/transactions${query}`);
  },
  createTransaction(payload) {
    return request('/transactions', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateTransaction(id, payload) {
    return request(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  deleteTransaction(id) {
    return request(`/transactions/${id}`, { method: 'DELETE' });
  },

  monthlySummary(year, month) {
    const qs = new URLSearchParams({ year: String(year), month: String(month) });
    return request(`/transactions/summary/monthly?${qs.toString()}`);
  },

  getBudget(year, month) {
    const qs = new URLSearchParams({ year: String(year), month: String(month) });
    return request(`/budgets?${qs.toString()}`);
  },
  upsertBudget(payload) {
    return request('/budgets', { method: 'PUT', body: JSON.stringify(payload) });
  },
};
