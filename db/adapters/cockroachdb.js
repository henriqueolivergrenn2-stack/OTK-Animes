/**
 * CockroachDB Adapter
 * Dependencia: npm install pg (usa driver PostgreSQL)
 * Gratuito: 5GB storage no serverless
 * URL: https://cockroachlabs.cloud
 */

class CockroachDBAdapter {
  constructor(config) {
    this.config = config;
    this.pool = null;
  }

  async connect() {
    if (this.pool) return this.pool;
    const { Pool } = require('pg');
    this.pool = new Pool({
      connectionString: this.config.connectionString,
      max: 10,
      ssl: this.config.ssl !== false ? { rejectUnauthorized: false } : false
    });
    return this.pool;
  }

  async init() {
    const pool = await this.connect();
    const tables = ['users', 'animes', 'episodes', 'history', 'settings'];
    for (const t of tables) {
      await pool.query(`CREATE TABLE IF NOT EXISTS ${t} (id STRING PRIMARY KEY, data JSONB)`);
    }
    const bcrypt = require('bcryptjs');
    await pool.query(
      `UPSERT INTO users (id, data) VALUES ($1, $2)`,
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
    return rows.map(r => {
      try { return typeof r.data === 'string' ? JSON.parse(r.data) : r.data; }
      catch { return r.data; }
    });
  }

  async write(table, data) {
    const pool = await this.connect();
    await pool.query(`DELETE FROM ${table}`);
    if (data && data.length > 0) {
      for (const item of data) {
        const id = item.id || Date.now().toString();
        await pool.query(`INSERT INTO ${table} (id, data) VALUES ($1, $2)`, [id, JSON.stringify(item)]);
      }
    }
  }

  async test() {
    try {
      const pool = await this.connect();
      await pool.query('SELECT 1');
      return { success: true, message: 'CockroachDB conectado!' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = CockroachDBAdapter;
