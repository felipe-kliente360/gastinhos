/**
 * Gastinhos – Shared JS module
 * Used by both index.html and lancamentos.html
 */

'use strict';

// ── Constants ───────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = ['Salário', 'Freelance', 'Investimentos', 'Outros (Receita)'];
const EXPENSE_CATEGORIES = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Vestuário', 'Assinaturas', 'Outros (Despesa)'];
const PEOPLE = ['Felipe', 'Esposa', 'Casal'];

// Category colors for charts
const CATEGORY_COLORS = {
  'Moradia':         '#6366f1',
  'Alimentação':     '#f59e0b',
  'Transporte':      '#3b82f6',
  'Saúde':           '#10b981',
  'Lazer':           '#ec4899',
  'Educação':        '#8b5cf6',
  'Vestuário':       '#f97316',
  'Assinaturas':     '#06b6d4',
  'Outros (Despesa)':'#94a3b8',
  'Salário':         '#10b981',
  'Freelance':       '#6366f1',
  'Investimentos':   '#f59e0b',
  'Outros (Receita)':'#94a3b8',
};

// ── Formatting utils ────────────────────────────────────────────────────────

/**
 * Format a number as Brazilian currency: R$ 1.234,56
 */
function formatBRL(amount) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date string YYYY-MM-DD to DD/MM/YYYY
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Get current month as YYYY-MM
 */
function getCurrentMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Get last N months as YYYY-MM strings, most recent last
 */
function getLastNMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  return months;
}

/**
 * Format YYYY-MM to human readable: "Jun 2026"
 */
function formatMonthLabel(yyyyMM) {
  const [y, m] = yyyyMM.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

// ── API helpers ─────────────────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'API error');
  }
  return data;
}

async function getTransactions(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `/api/transactions${qs ? '?' + qs : ''}`;
  const data = await apiFetch(url);
  return data.transactions;
}

async function createTransaction(payload) {
  return apiFetch('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function deleteTransaction(id) {
  return apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
}

// ── Toast notifications ─────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✓' : '✕';
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Sidebar / mobile nav ────────────────────────────────────────────────────

function initSidebar() {
  const hamburger = document.querySelector('.hamburger');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  if (!hamburger || !sidebar) return;

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
}

// ── Transaction row HTML ────────────────────────────────────────────────────

function buildTransactionRow(t, onDelete) {
  const tr = document.createElement('tr');

  const typeIcon = t.type === 'income'
    ? `<span class="type-icon income" title="Receita">↑</span>`
    : `<span class="type-icon expense" title="Despesa">↓</span>`;

  const amountClass = t.type === 'income' ? 'income' : 'expense';
  const sign = t.type === 'income' ? '+' : '-';

  tr.innerHTML = `
    <td>${typeIcon}</td>
    <td>${formatDate(t.date)}</td>
    <td class="desc-cell">${escapeHtml(t.description)}</td>
    <td><span class="badge badge-cat">${escapeHtml(t.category)}</span></td>
    <td><span class="person-tag ${t.person}">${t.person}</span></td>
    <td class="amount-cell ${amountClass}">${sign} ${formatBRL(t.amount)}</td>
    <td>
      <button class="btn-delete" title="Excluir" aria-label="Excluir transação">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14H6L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4h6v2"></path>
        </svg>
      </button>
    </td>
  `;

  tr.querySelector('.btn-delete').addEventListener('click', () => onDelete(t.id));
  return tr;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

// ── Export globals ──────────────────────────────────────────────────────────

window.GastApp = {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  PEOPLE,
  CATEGORY_COLORS,
  formatBRL,
  formatDate,
  getCurrentMonth,
  getLastNMonths,
  formatMonthLabel,
  apiFetch,
  getTransactions,
  createTransaction,
  deleteTransaction,
  showToast,
  initSidebar,
  buildTransactionRow,
  escapeHtml,
};
