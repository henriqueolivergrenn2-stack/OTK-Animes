/**
 * MySQL Adapter (direto - local, RDS, Cloud SQL, etc)
 * Dependencia: npm install mysql2
 */

class MySQLAdapter {
  constructor(config) {
    this.config = config;
    this.pool = null;
  }

  async connect() {
    if (this.pool) return this.pool;
    const mysql = require('mysql2/promise');
    this.pool = mysql.createPool({
      host: this.config.host,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database || 'otkanimes',
      port: this.config.port || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    return this.pool;
  }

  async init() {
    const pool = await this.connect();
    const tables = ['users', 'animes', 'episodes', 'history', 'settings'];
    for (const t of tables) {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${t} (
          id VARCHAR(255) PRIMARY KEY,
          data JSON
        )
      `);
    }
    const bcrypt = require('bcryptjs');
    await pool.execute(
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
    const pool = await this.connect();
    const [rows] = await pool.execute(`SELECT data FROM ${table}`);
    return rows.map(r => {
      try { return typeof r.data === 'string' ? JSON.parse(r.data) : r.data; }
      catch { return r.data; }
    });
  }

  async write(table, data) {
    const pool = await this.connect();
    await pool.execute(`DELETE FROM ${table}`);
    if (data && data.length > 0) {
      for (const item of data) {
        const id = item.id || require('crypto').randomUUID();
        await pool.execute(`INSERT INTO ${table} (id, data) VALUES (?, ?)`, [id, JSON.stringify(item)]);
      }
    }
  }

  async test() {
    try {
      const pool = await this.connect();
      await pool.execute('SELECT 1');
      return { success: true, message: 'MySQL conectado!' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = MySQLAdapter;
