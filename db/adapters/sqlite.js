/**
 * SQLite Adapter - usa sqlite3 (async, prebuilds disponiveis)
 * Funciona no Termux Android!
 * npm install sqlite3
 */

const fs = require('fs');
const path = require('path');

class SQLiteAdapter {
  constructor(config) {
    this.config = config || {};
    this.dbPath = this.config.filePath || path.join(__dirname, '..', '..', 'data', 'otkanimes.db');
    this.db = null;
  }

  async connect() {
    if (this.db) return this.db;
    const sqlite3 = require('sqlite3');
    const { open } = require('sqlite3');
    // Usa o Database do sqlite3 diretamente com modo serialized
    const { Database } = sqlite3;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return new Promise((resolve, reject) => {
      this.db = new Database(this.dbPath, (err) => {
        if (err) reject(err);
        else resolve(this.db);
      });
    });
  }

  async run(sql, params) {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      db.run(sql, params || [], function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async all(sql, params) {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      db.all(sql, params || [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async init() {
    await this.connect();
    const tables = ['users', 'animes', 'episodes', 'history', 'settings'];
    for (const t of tables) {
      await this.run(`CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, data TEXT)`);
    }
    const bcrypt = require('bcryptjs');
    await this.run(
      `INSERT OR IGNORE INTO users (id, data) VALUES (?, ?)`,
      ['admin-001', JSON.stringify({
        id: 'admin-001', name: 'Administrador', email: 'admin@otkanimes.com',
        password: bcrypt.hashSync('admin123', 10), role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        createdAt: new Date().toISOString()
      })]
    );
  }

  async read(table) {
    const rows = await this.all(`SELECT data FROM ${table}`);
    return rows.map(r => { try { return JSON.parse(r.data); } catch { return {}; } });
  }

  async write(table, data) {
    await this.run(`DELETE FROM ${table}`);
    if (data && data.length > 0) {
      for (const item of data) {
        const id = item.id || Date.now().toString() + Math.random().toString(36).slice(2);
        await this.run(`INSERT INTO ${table} (id, data) VALUES (?, ?)`, [id, JSON.stringify(item)]);
      }
    }
  }

  async test() {
    try {
      await this.connect();
      await this.all('SELECT 1');
      return { success: true, message: 'SQLite conectado! (' + this.dbPath + ')' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = SQLiteAdapter;
