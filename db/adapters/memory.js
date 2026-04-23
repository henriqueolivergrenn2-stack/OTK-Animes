/**
 * Memory Adapter - para Vercel e ambientes serverless sem disco
 * Dados ficam em RAM (perde ao reiniciar, mas funciona perfeitamente)
 * Ideal para testes e deploy serverless
 */
const bcrypt = require('bcryptjs');

class MemoryAdapter {
  constructor(config) {
    this.config = config || {};
    this.data = {};
  }

  async init() {
    const tables = ['users', 'animes', 'episodes', 'history', 'settings'];
    tables.forEach(t => {
      if (!this.data[t]) this.data[t] = [];
    });
    // Cria admin se nao existir
    if (!this.data.users.find(u => u.email === 'admin@otkanimes.com')) {
      this.data.users.push({
        id: 'admin-001', name: 'Administrador', email: 'admin@otkanimes.com',
        password: bcrypt.hashSync('admin123', 10), role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        createdAt: new Date().toISOString()
      });
    }
  }

  async read(table) {
    return this.data[table] || [];
  }

  async write(table, data) {
    this.data[table] = data || [];
  }

  async test() {
    return { success: true, message: 'Memory adapter OK! Dados em RAM (perdem ao reiniciar).' };
  }
}

module.exports = MemoryAdapter;
