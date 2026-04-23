/**
 * PlanetScale MySQL Adapter
 * Dependencia: npm install @planetscale/database
 * Gratuito: 5GB storage, 1B rows
 * URL: https://planetscale.com
 */

class PlanetScaleAdapter {
  constructor(config) {
    this.config = config;
    this.conn = null;
  }

  async connect() {
    if (this.conn) return this.conn;
    const { connect } = require('@planetscale/database');
    this.conn = connect({
      host: this.config.host,
      username: this.config.username,
      password: this.config.password
    });
    return this.conn;
  }

  async init() {
    const conn = await this.connect();
    // Cria tabelas se nao existirem
    const tables = ['users', 'animes', 'episodes', 'history', 'settings'];
    for (const t of tables) {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS ${t} (
          id VARCHAR(255) PRIMARY KEY,
          data JSON
        )
      `);
    }
    const bcrypt = require('bcryptjs');
    await conn.execute(
      `INSERT IGNORE INTO users (id, data) VALUES (?, ?)`,
      ['admin-001', JSON.stringify({
        id: 'admin-001', name: 'Administrador', email: 'admin@otkanimes.com',
        password: bcrypt.hashSync('admin123', 10), role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        createdAt: new Date().toISOString()
      })]
    );
  }

  async read(table) {
    const conn = await this.connect();
    const { rows } = await conn.execute(`SELECT data FROM ${table}`);
    return rows.map(r => {
      try { return typeof r.data === 'string' ? JSON.parse(r.data) : r.data; }
      catch { return r.data; }
    });
  }

  async write(table, data) {
    const conn = await this.connect();
    await conn.execute(`DELETE FROM ${table}`);
    if (data && data.length > 0) {
      for (const item of data) {
        const id = item.id || require('crypto').randomUUID();
        await conn.execute(`INSERT INTO ${table} (id, data) VALUES (?, ?)`, [id, JSON.stringify(item)]);
      }
    }
  }

  async test() {
    try {
      const conn = await this.connect();
      await conn.execute('SELECT 1');
      return { success: true, message: 'PlanetScale conectado!' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = PlanetScaleAdapter;
