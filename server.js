const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'transactions.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: read transactions from file
function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

// Helper: write transactions to file
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Validation
const VALID_TYPES = ['income', 'expense'];
const VALID_PEOPLE = ['Felipe', 'Esposa', 'Casal'];
const INCOME_CATEGORIES = ['Salário', 'Freelance', 'Investimentos', 'Outros (Receita)'];
const EXPENSE_CATEGORIES = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Vestuário', 'Assinaturas', 'Outros (Despesa)'];

function validateTransaction(body, requireAll = true) {
  const errors = [];

  if (requireAll || body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type)) {
      errors.push('type must be "income" or "expense"');
    }
  }

  if (requireAll || body.amount !== undefined) {
    if (typeof body.amount !== 'number' || body.amount <= 0) {
      errors.push('amount must be a positive number');
    }
  }

  if (requireAll || body.person !== undefined) {
    if (!VALID_PEOPLE.includes(body.person)) {
      errors.push('person must be "Felipe", "Esposa", or "Casal"');
    }
  }

  if (requireAll || body.date !== undefined) {
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      errors.push('date must be in YYYY-MM-DD format');
    }
  }

  if (requireAll || body.category !== undefined) {
    const validCats = body.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!validCats.includes(body.category)) {
      errors.push(`category "${body.category}" is not valid for type "${body.type}"`);
    }
  }

  if (requireAll || body.description !== undefined) {
    if (!body.description || typeof body.description !== 'string' || body.description.trim() === '') {
      errors.push('description is required');
    }
  }

  return errors;
}

// GET /api/transactions
app.get('/api/transactions', (req, res) => {
  try {
    const data = readData();
    let transactions = data.transactions;

    const { month, person, type } = req.query;

    if (month) {
      // month format: YYYY-MM
      transactions = transactions.filter(t => t.date.startsWith(month));
    }

    if (person && person !== 'all') {
      transactions = transactions.filter(t => t.person === person);
    }

    if (type && type !== 'all') {
      transactions = transactions.filter(t => t.type === type);
    }

    // Sort by date descending
    transactions = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read transactions' });
  }
});

// POST /api/transactions
app.post('/api/transactions', (req, res) => {
  try {
    const body = req.body;
    const errors = validateTransaction(body, true);

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const data = readData();
    const newTransaction = {
      id: uuidv4(),
      date: body.date,
      type: body.type,
      amount: Number(body.amount),
      category: body.category,
      person: body.person,
      description: body.description.trim()
    };

    data.transactions.push(newTransaction);
    writeData(data);

    res.status(201).json({ transaction: newTransaction });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// PUT /api/transactions/:id
app.put('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const data = readData();

    const index = data.transactions.findIndex(t => t.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Merge existing with updates
    const merged = { ...data.transactions[index], ...body };
    const errors = validateTransaction(merged, true);

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    data.transactions[index] = {
      id,
      date: merged.date,
      type: merged.type,
      amount: Number(merged.amount),
      category: merged.category,
      person: merged.person,
      description: merged.description.trim()
    };

    writeData(data);
    res.json({ transaction: data.transactions[index] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// DELETE /api/transactions/:id
app.delete('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = readData();

    const index = data.transactions.findIndex(t => t.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    data.transactions.splice(index, 1);
    writeData(data);

    res.json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Catch-all: serve index.html for unknown routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Gastinhos server running at http://localhost:${PORT}`);
});
