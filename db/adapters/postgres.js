/**
 * PostgreSQL Adapter (direto - local, RDS, ElephantSQL, etc)
 * Dependencia: npm install pg
 */

class PostgresAdapter {
  constructor(config) {
    this.config = config;
    this.pool = null;
  }

  async connect() {
    if (this.pool) return this.pool;
    const { Pool } = require('pg');
    this.pool = new Pool({
      host: this.config.host,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database || 'otkanimes',
      port: this.config.port || 5432,
      max: 10
    });
    return this.pool;
  }

  async init() {
    const pool = await this.connect();
    const tables = ['users', 'animes', 'episodes', 'history', 'settings'];
    for (const t of tables) {
      await pool.query(`CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, data JSONB)`);
    }
    const bcrypt = require('bcryptjs');
    await pool.query(
      `INSERT INTO users (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING`,
      ['admin-001', JSON.stringify({
        id: 'admin-001', name: 'Administrador', email: 'admin@otkanimes.com',
        password: bcrypt.hashSync('admin123', 10), role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        createdAt: new Date().toISOString()
      })]
    );
  }

  async read(table) {
    const pool = await this.connect();
    const { rows } = await pool.query(`SELECT data FROM ${table}`);
    return rows.map(r => r.data);
  }

  async write(table, data) {
    const pool = await this.connect();
    await pool.query(`DELETE FROM ${table}`);
    if (data && data.length > 0) {
      for (const item of data) {
        const id = item.id || Date.now().toString();
        await pool.query(`INSERT INTO ${table} (id, data) VALUES ($1, $2::jsonb)`, [id, JSON.stringify(item)]);
      }
    }
  }

  async test() {
    try {
      const pool = await this.connect();
      await pool.query('SELECT 1');
      return { success: true, message: 'PostgreSQL conectado!' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = PostgresAdapter;
