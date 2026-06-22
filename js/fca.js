import { addTx, addTxBatch, updateTx } from './db.js';
import { todayStr, formatBRL, showToast, monthLabel, addMonths } from './utils.js';

const MEM_KEY = 'gastinhos_fca_mem';

let currentPay = '';
let isProvisao = false;
let amountCents = 0;
let updatingAmount = false;
let editId = null;

export function initFCA() {
  document.getElementById('fca-btn').addEventListener('click', openFCA);
  document.getElementById('fca-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('fca-overlay')) closeFCA();
  });

  // Cent-accumulation amount input
  document.getElementById('fca-amount').addEventListener('input', e => {
    if (updatingAmount) return;
    updatingAmount = true;
    const digits = e.target.value.replace(/\D/g, '');
    amountCents = parseInt(digits || '0', 10);
    const rawAmount = amountCents / 100;
    e.target.value = amountCents > 0 ? formatBRL(rawAmount) : '';
    updatingAmount = false;
    updateSubmitState();
    updateInstallmentCalc();
  });

  // Person select
  document.getElementById('fca-person-select').addEventListener('change', () => {
    updateSubmitState();
  });

  // Category select
  document.getElementById('fca-cat-select').addEventListener('change', () => {
    updateSubmitState();
  });

  // Payment chips
  document.getElementById('fca-pay-chips').addEventListener('click', e => {
    const btn = e.target.closest('[data-val]'); if (!btn) return;
    document.querySelectorAll('#fca-pay-chips .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active'); currentPay = btn.dataset.val;
    const inst = document.getElementById('fca-installment-section');
    if (currentPay === 'Crédito') inst.classList.remove('hidden');
    else { inst.classList.add('hidden'); document.getElementById('fca-inst-count').value = 1; }
    updateInstallmentCalc();
  });

  // Provisão checkbox
  document.getElementById('fca-provisao-check').addEventListener('change', e => {
    isProvisao = e.target.checked;
  });

  // Date change: auto-enforce provisão
  document.getElementById('fca-date').addEventListener('change', () => {
    enforceDateProvisao();
    updateInstallmentCalc();
  });

  document.getElementById('fca-inst-count').addEventListener('input', updateInstallmentCalc);
  document.getElementById('fca-submit').addEventListener('click', handleSubmit);

  // Listen for edit-tx events from historico
  window.addEventListener('gastinhos:edit-tx', e => {
    openEditFCA(e.detail);
  });
}

function enforceDateProvisao() {
  const dateVal = document.getElementById('fca-date').value;
  const today = todayStr();
  const checkbox = document.getElementById('fca-provisao-check');
  if (!dateVal) return;
  if (dateVal < today) {
    isProvisao = false;
    checkbox.checked = false;
    checkbox.disabled = true;
  } else if (dateVal > today) {
    isProvisao = true;
    checkbox.checked = true;
    checkbox.disabled = true;
  } else {
    checkbox.disabled = false;
  }
}

function openFCA() {
  const mem = (() => { try { return JSON.parse(localStorage.getItem(MEM_KEY)) || {}; } catch { return {}; } })();
  amountCents = 0; isProvisao = false; editId = null;

  document.getElementById('fca-amount').value = '';
  document.getElementById('fca-description').value = '';
  document.getElementById('fca-date').value = todayStr();
  document.getElementById('fca-inst-count').value = 1;
  document.getElementById('fca-installment-section').classList.add('hidden');
  const checkbox = document.getElementById('fca-provisao-check');
  checkbox.checked = false;
  checkbox.disabled = false;

  // Restore person from memory
  const personSelect = document.getElementById('fca-person-select');
  personSelect.value = mem.person || '';

  // Restore category from memory
  const catSelect = document.getElementById('fca-cat-select');
  catSelect.value = mem.cat || '';

  // Restore payment from memory
  currentPay = mem.pay || '';
  document.querySelectorAll('#fca-pay-chips .chip').forEach(c => c.classList.toggle('active', c.dataset.val === currentPay));
  if (currentPay === 'Crédito') document.getElementById('fca-installment-section').classList.remove('hidden');

  document.getElementById('fca-submit').textContent = 'Lançar';
  updateSubmitState();
  document.getElementById('fca-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('fca-amount').focus(), 250);
}

function openEditFCA(tx) {
  openFCA();
  editId = tx.id;

  // Amount
  amountCents = Math.round(tx.amount * 100);
  const rawAmount = amountCents / 100;
  document.getElementById('fca-amount').value = formatBRL(rawAmount);

  // Date
  document.getElementById('fca-date').value = tx.date;

  // Person
  document.getElementById('fca-person-select').value = tx.person || '';

  // Category
  document.getElementById('fca-cat-select').value = tx.category || '';

  // Payment
  currentPay = tx.payment_method || '';
  document.querySelectorAll('#fca-pay-chips .chip').forEach(c => c.classList.toggle('active', c.dataset.val === currentPay));
  const inst = document.getElementById('fca-installment-section');
  if (currentPay === 'Crédito') inst.classList.remove('hidden');
  else inst.classList.add('hidden');

  // Description
  document.getElementById('fca-description').value = tx.description || '';

  // Provisão
  const checkbox = document.getElementById('fca-provisao-check');
  isProvisao = tx.status === 'provisao';
  checkbox.checked = isProvisao;

  // Apply date provisão enforcement
  enforceDateProvisao();

  document.getElementById('fca-submit').textContent = 'Salvar alterações';
  updateSubmitState();
}

function closeFCA() {
  document.getElementById('fca-overlay').classList.add('hidden');
}

function updateSubmitState() {
  const rawAmount = amountCents / 100;
  const person = document.getElementById('fca-person-select').value;
  const cat = document.getElementById('fca-cat-select').value;
  const ok = rawAmount > 0 && person && cat;
  document.getElementById('fca-submit').disabled = !ok;
}

function updateInstallmentCalc() {
  const n = parseInt(document.getElementById('fca-inst-count').value) || 1;
  const amount = amountCents / 100;
  const summary = document.getElementById('fca-inst-summary');
  if (n > 1 && amount > 0) {
    const dateStr = document.getElementById('fca-date').value;
    if (dateStr) {
      const [y, m] = dateStr.split('-').map(Number);
      const last = addMonths(y, m, n - 1);
      summary.textContent = `${n}x de ${formatBRL(amount / n)} · até ${monthLabel(last.year, last.month)}`;
    }
  } else { summary.textContent = ''; }
}

async function handleSubmit() {
  const amount = amountCents / 100;
  if (!amount || amount <= 0) return;
  const dateStr = document.getElementById('fca-date').value;
  const desc = document.getElementById('fca-description').value.trim() || null;
  const n = parseInt(document.getElementById('fca-inst-count').value) || 1;
  const [y, m, d] = dateStr.split('-').map(Number);
  const today = todayStr();
  const currentPerson = document.getElementById('fca-person-select').value;
  const currentCat = document.getElementById('fca-cat-select').value;

  const btn = document.getElementById('fca-submit');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  try {
    if (editId) {
      // Edit mode: update single transaction
      const status = isProvisao ? 'provisao' : 'realizado';
      await updateTx(editId, {
        date: dateStr,
        amount,
        category: currentCat,
        person: currentPerson,
        description: desc,
        payment_method: currentPay || null,
        status
      });
      showToast('Alterações salvas');
    } else if (n <= 1) {
      const status = isProvisao ? 'provisao' : 'realizado';
      await addTx({
        date: dateStr, type: 'expense', amount, category: currentCat,
        person: currentPerson, description: desc, payment_method: currentPay || null, status
      });
      showToast(status === 'provisao' ? 'Provisão registrada' : 'Lançamento salvo');
    } else {
      const groupId = crypto.randomUUID();
      const perAmount = Math.round(amount / n * 100) / 100;
      const rows = Array.from({ length: n }, (_, i) => {
        const dt = addMonths(y, m, i);
        const dateI = `${dt.year}-${String(dt.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const status = isProvisao ? 'provisao' : (dateI <= today ? 'realizado' : 'provisao');
        return {
          date: dateI, type: 'expense', amount: perAmount, category: currentCat,
          person: currentPerson, description: desc, payment_method: 'Crédito',
          installment_current: i + 1, installment_total: n, installment_group_id: groupId, status
        };
      });
      await addTxBatch(rows);
      showToast(`${n} parcelas criadas`);
    }
    localStorage.setItem(MEM_KEY, JSON.stringify({ person: currentPerson, pay: currentPay, cat: currentCat }));
    closeFCA();
    window.dispatchEvent(new CustomEvent('gastinhos:tx-saved'));
  } catch (e) {
    showToast('Erro ao salvar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editId ? 'Salvar alterações' : 'Lançar';
  }
}
