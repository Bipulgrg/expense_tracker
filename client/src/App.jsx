import React, { useEffect, useMemo, useState } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

import { api } from './lib/api.js';
import { daysInMonth, yyyyMmDd } from './lib/date.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

function money(n) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    Number(n || 0)
  );
}

function monthOptions() {
  const now = new Date();
  const out = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return out;
}

export default function App() {
  const monthChoices = useMemo(() => monthOptions(), []);
  const [selected, setSelected] = useState(monthChoices[0]);

  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem('auth');
      return raw ? JSON.parse(raw) : { token: '', user: null };
    } catch {
      return { token: '', user: null };
    }
  });
  const [authModal, setAuthModal] = useState({ open: false, mode: 'login' });
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });

  const [categories, setCategories] = useState([]);
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    type: '',
    categoryId: '',
    from: '',
    to: '',
  });

  const [form, setForm] = useState({
    id: null,
    type: 'expense',
    amount: '',
    note: '',
    categoryId: '',
    date: yyyyMmDd(new Date()),
  });

  const [newCategory, setNewCategory] = useState({ name: '', color: '#64748b' });

  const [budget, setBudget] = useState(null);
  const [budgetAmount, setBudgetAmount] = useState('');

  const [monthlySummary, setMonthlySummary] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem('auth', JSON.stringify(auth));
    } catch {
      // ignore
    }
  }, [auth]);

  async function refreshAll() {
    setError('');
    setLoading(true);
    try {
      const [catsRes, txRes, sumRes, budgetRes] = await Promise.all([
        api.listCategories(),
        api.listTransactions({
          ...filters,
          page: 1,
          limit: 100,
        }),
        api.monthlySummary(selected.year, selected.month),
        api.getBudget(selected.year, selected.month),
      ]);

      setCategories(catsRes.categories);
      setTx(txRes.transactions);
      setMonthlySummary(sumRes);
      setBudget(budgetRes.budget);
      setBudgetAmount(budgetRes.budget?.amount != null ? String(budgetRes.budget.amount) : '');
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.year, selected.month]);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.categoryId, filters.from, filters.to]);

  const categoryById = useMemo(() => {
    const map = new Map();
    for (const c of categories) map.set(c._id, c);
    return map;
  }, [categories]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of tx) {
      if (t.type === 'income') income += t.amount;
      if (t.type === 'expense') expense += t.amount;
    }
    const balance = income - expense;
    return {
      income,
      expense,
      balance,
      savingsRate: income > 0 ? ((balance / income) * 100).toFixed(1) : '0.0',
    };
  }, [tx]);

  const budgetAlert = useMemo(() => {
    if (!budget?.amount) return null;
    const used = totals.expense;
    const pct = budget.amount > 0 ? (used / budget.amount) * 100 : 0;
    if (pct >= 100) {
      return { kind: 'danger', text: `Budget exceeded: ${money(used)} / ${money(budget.amount)} (${pct.toFixed(0)}%)` };
    }
    if (pct >= 80) {
      return { kind: '', text: `Budget warning: ${money(used)} / ${money(budget.amount)} (${pct.toFixed(0)}%)` };
    }
    return null;
  }, [budget, totals.expense]);

  const expenseByCategory = useMemo(() => {
    const map = new Map();
    for (const t of tx) {
      if (t.type !== 'expense') continue;
      const key = t.categoryId || 'uncategorized';
      map.set(key, (map.get(key) || 0) + t.amount);
    }
    const items = Array.from(map.entries()).map(([id, total]) => {
      const c = id === 'uncategorized' ? null : categoryById.get(id);
      return {
        id,
        name: c?.name || 'Uncategorized',
        color: c?.color || '#94a3b8',
        total,
      };
    });
    items.sort((a, b) => b.total - a.total);
    return items;
  }, [tx, categoryById]);

  const charts = useMemo(() => {
    const dCount = daysInMonth(selected.year, selected.month);
    const labels = Array.from({ length: dCount }, (_, i) => String(i + 1).padStart(2, '0'));

    const incomeByDay = new Array(dCount).fill(0);
    const expenseByDay = new Array(dCount).fill(0);

    const inc = monthlySummary?.summary?.income?.byDay || [];
    const exp = monthlySummary?.summary?.expense?.byDay || [];

    for (const row of inc) {
      const idx = row.day - 1;
      if (idx >= 0 && idx < dCount) incomeByDay[idx] = row.total;
    }
    for (const row of exp) {
      const idx = row.day - 1;
      if (idx >= 0 && idx < dCount) expenseByDay[idx] = row.total;
    }

    const lineData = {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeByDay,
          borderColor: 'rgba(34,197,94,1)',
          backgroundColor: 'rgba(34,197,94,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
        {
          label: 'Expenses',
          data: expenseByDay,
          borderColor: 'rgba(245,158,11,1)',
          backgroundColor: 'rgba(245,158,11,0.10)',
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    };

    const doughnutData = {
      labels: expenseByCategory.map((x) => x.name),
      datasets: [
        {
          data: expenseByCategory.map((x) => x.total),
          backgroundColor: expenseByCategory.map((x) => x.color),
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
        },
      ],
    };

    return { lineData, doughnutData };
  }, [monthlySummary, selected.year, selected.month, expenseByCategory]);

  async function onSubmitTx(e) {
    e.preventDefault();
    setError('');

    const payload = {
      type: form.type,
      amount: Number(form.amount),
      note: form.note,
      categoryId: form.categoryId || null,
      date: form.date,
    };

    try {
      if (form.id) {
        await api.updateTransaction(form.id, payload);
      } else {
        await api.createTransaction(payload);
      }

      setForm({
        id: null,
        type: 'expense',
        amount: '',
        note: '',
        categoryId: '',
        date: yyyyMmDd(new Date()),
      });

      await refreshAll();
    } catch (e2) {
      setError(e2.message || 'Failed');
    }
  }

  function onEditTx(t) {
    setForm({
      id: t._id,
      type: t.type,
      amount: String(t.amount),
      note: t.note || '',
      categoryId: t.categoryId || '',
      date: yyyyMmDd(t.date),
    });
  }

  async function onDeleteTx(id) {
    setError('');
    try {
      await api.deleteTransaction(id);
      await refreshAll();
    } catch (e) {
      setError(e.message || 'Failed');
    }
  }

  async function onCreateCategory(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createCategory({
        name: newCategory.name,
        color: newCategory.color,
      });
      setNewCategory({ name: '', color: '#64748b' });
      await refreshAll();
    } catch (e2) {
      setError(e2.message || 'Failed');
    }
  }

  async function onDeleteCategory(id) {
    setError('');
    try {
      await api.deleteCategory(id);
      await refreshAll();
    } catch (e) {
      setError(e.message || 'Failed');
    }
  }

  async function onSaveBudget(e) {
    e.preventDefault();
    setError('');
    try {
      const amt = Number(budgetAmount || 0);
      const res = await api.upsertBudget({ year: selected.year, month: selected.month, amount: amt });
      setBudget(res.budget);
      await refreshAll();
    } catch (e2) {
      setError(e2.message || 'Failed');
    }
  }

  async function submitAuth(e) {
    e.preventDefault();
    setError('');
    try {
      if (authModal.mode === 'signup') {
        const res = await api.signup({
          name: authForm.name,
          email: authForm.email,
          password: authForm.password,
        });
        setAuth({ token: res.token, user: res.user });
      } else {
        const res = await api.login({
          email: authForm.email,
          password: authForm.password,
        });
        setAuth({ token: res.token, user: res.user });
      }

      setAuthModal({ open: false, mode: 'login' });
      setAuthForm({ name: '', email: '', password: '' });
    } catch (e2) {
      setError(e2.message || 'Auth failed');
    }
  }

  function logout() {
    setAuth({ token: '', user: null });
  }

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" />
          <div>
            <div className="h1">Expense Tracker</div>
            <div className="subtitle">Transactions • Charts • Budgets</div>
          </div>
        </div>

        <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <div className="field" style={{ minWidth: 220 }}>
            <label>Month</label>
            <select
              value={`${selected.year}-${selected.month}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map((x) => Number(x));
                setSelected({ year: y, month: m });
              }}
            >
              {monthChoices.map((m) => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                  {new Date(m.year, m.month - 1, 1).toLocaleString(undefined, {
                    month: 'long',
                    year: 'numeric',
                  })}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ minWidth: 220 }}>
            <label>Quick filter</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          {auth?.user ? (
            <div className="field" style={{ minWidth: 220 }}>
              <label>Account</label>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <span className="badge" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {auth.user.name || auth.user.email}
                </span>
                <button type="button" className="danger" onClick={logout}>
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="field" style={{ minWidth: 220 }}>
              <label>Account</label>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setAuthModal({ open: true, mode: 'login' });
                    setAuthForm({ name: '', email: '', password: '' });
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModal({ open: true, mode: 'signup' });
                    setAuthForm({ name: '', email: '', password: '' });
                  }}
                >
                  Signup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {authModal.open ? (
        <div
          role="presentation"
          onClick={() => setAuthModal({ open: false, mode: 'login' })}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            className="panel"
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(520px, 100%)' }}
          >
            <div className="panelInner">
              <div className="subtitle" style={{ marginBottom: 10 }}>
                {authModal.mode === 'signup' ? 'Create account' : 'Login'}
              </div>
              <form onSubmit={submitAuth}>
                {authModal.mode === 'signup' ? (
                  <div className="field">
                    <label>Name</label>
                    <input
                      value={authForm.name}
                      onChange={(e) => setAuthForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                ) : null}

                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(e) => setAuthForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="field">
                  <label>Password</label>
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>

                <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setAuthModal((m) => ({
                        open: true,
                        mode: m.mode === 'signup' ? 'login' : 'signup',
                      }))
                    }
                  >
                    {authModal.mode === 'signup' ? 'Have an account? Login' : 'New? Signup'}
                  </button>
                  <button type="submit">Continue</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="alert danger">{error}</div> : null}
      {budgetAlert ? <div className={`alert ${budgetAlert.kind}`}>{budgetAlert.text}</div> : null}

      <div className="kpis">
        <div className="kpi">
          <div className="kpiLabel">Balance</div>
          <div className="kpiValue">{money(totals.balance)}</div>
          <div className="kpiHint">Income - Expenses</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">Income</div>
          <div className="kpiValue">{money(totals.income)}</div>
          <div className="kpiHint">Filtered range</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">Expenses</div>
          <div className="kpiValue">{money(totals.expense)}</div>
          <div className="kpiHint">Filtered range</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">Savings rate</div>
          <div className="kpiValue">{totals.savingsRate}%</div>
          <div className="kpiHint">Balance / Income</div>
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panelInner">
            <div className="subtitle" style={{ marginBottom: 10 }}>Add / Edit Transaction</div>

            <form onSubmit={onSubmitTx}>
              <div className="row">
                <div className="field">
                  <label>Type</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div className="field">
                  <label>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>

                <div className="field">
                  <label>Category</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Note</label>
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g., groceries / salary"
                />
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <button type="submit" disabled={loading}>
                  {form.id ? 'Update' : 'Add'}
                </button>
                {form.id ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setForm({
                        id: null,
                        type: 'expense',
                        amount: '',
                        note: '',
                        categoryId: '',
                        date: yyyyMmDd(new Date()),
                      })
                    }
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>

            <div style={{ height: 16 }} />

            <div className="subtitle" style={{ marginBottom: 10 }}>Budget (monthly)</div>
            <form onSubmit={onSaveBudget}>
              <div className="row">
                <div className="field">
                  <label>Budget amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="field" style={{ flex: 0, minWidth: 120, alignSelf: 'flex-end' }}>
                  <button type="submit" className="secondary" disabled={loading}>
                    Save
                  </button>
                </div>
              </div>
            </form>

            <div style={{ height: 16 }} />

            <div className="subtitle" style={{ marginBottom: 10 }}>Categories</div>
            <form onSubmit={onCreateCategory}>
              <div className="row">
                <div className="field">
                  <label>Name</label>
                  <input
                    value={newCategory.name}
                    onChange={(e) => setNewCategory((c) => ({ ...c, name: e.target.value }))}
                    placeholder="e.g., Food"
                    required
                  />
                </div>
                <div className="field" style={{ maxWidth: 140 }}>
                  <label>Color</label>
                  <input
                    type="color"
                    value={newCategory.color}
                    onChange={(e) => setNewCategory((c) => ({ ...c, color: e.target.value }))}
                  />
                </div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button type="submit" className="secondary" disabled={loading}>Add category</button>
              </div>
            </form>

            <div style={{ height: 10 }} />
            <div className="row">
              {categories.map((c) => (
                <span className="badge" key={c._id} title={c._id}>
                  <span className="dot" style={{ background: c.color }} />
                  {c.name}
                  <button
                    type="button"
                    className="danger"
                    style={{ padding: '4px 8px', borderRadius: 999 }}
                    onClick={() => onDeleteCategory(c._id)}
                  >
                    Del
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panelInner">
              <div className="split">
                <div>
                  <div className="subtitle" style={{ marginBottom: 10 }}>All expenses (by category)</div>
                  <Doughnut
                    data={charts.doughnutData}
                    options={{
                      plugins: { legend: { position: 'right', labels: { color: '#e5e7eb' } } },
                    }}
                  />
                </div>
                <div>
                  <div className="subtitle" style={{ marginBottom: 10 }}>Earnings (daily)</div>
                  <Line
                    data={charts.lineData}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { labels: { color: '#e5e7eb' } },
                      },
                      scales: {
                        x: { ticks: { color: '#a3a3a3' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        y: { ticks: { color: '#a3a3a3' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panelInner">
              <div className="subtitle" style={{ marginBottom: 10 }}>Transactions</div>

              <div className="row" style={{ marginBottom: 10 }}>
                <div className="field">
                  <label>From</label>
                  <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
                </div>
                <div className="field">
                  <label>To</label>
                  <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Category</label>
                  <select value={filters.categoryId} onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}>
                    <option value="">All</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ flex: 0, minWidth: 120, alignSelf: 'flex-end' }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setFilters({ type: '', categoryId: '', from: '', to: '' })}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Note</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tx.map((t) => {
                    const c = t.categoryId ? categoryById.get(t.categoryId) : null;
                    return (
                      <tr key={t._id}>
                        <td>{yyyyMmDd(t.date)}</td>
                        <td>{t.type}</td>
                        <td>
                          <span className="badge">
                            <span className="dot" style={{ background: c?.color || '#94a3b8' }} />
                            {c?.name || 'Uncategorized'}
                          </span>
                        </td>
                        <td>{t.note || ''}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {t.type === 'expense' ? '-' : '+'}
                          {money(t.amount)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="row" style={{ justifyContent: 'flex-end' }}>
                            <button type="button" className="secondary" onClick={() => onEditTx(t)}>
                              Edit
                            </button>
                            <button type="button" className="danger" onClick={() => onDeleteTx(t._id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {tx.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ color: '#a3a3a3', padding: 14 }}>
                        No transactions yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
