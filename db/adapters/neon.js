/**
 * Neon PostgreSQL Adapter
 * Dependencia: npm install @neondatabase/serverless
 * Gratuito: 512MB storage (Free Tier)
 * URL: https://neon.tech
 */

class NeonAdapter {
  constructor(config) {
    this.config = config;
    this.sql = null;
  }

  async connect() {
    if (this.sql) return this.sql;
    const { neon } = require('@neondatabase/serverless');
    this.sql = neon(this.config.connectionString);
    return this.sql;
  }

  async init() {
    const sql = await this.connect();
    const tables = ['users', 'animes', 'episodes', 'history', 'settings'];
    for (const t of tables) {
      await sql`CREATE TABLE IF NOT EXISTS ${sql(t)} (id TEXT PRIMARY KEY, data JSONB)`;
    }
    const bcrypt = require('bcryptjs');
    const adminData = JSON.stringify({
      id: 'admin-001', name: 'Administrador', email: 'admin@otkanimes.com',
      password: bcrypt.hashSync('admin123', 10), role: 'admin',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
      createdAt: new Date().toISOString()
    });
    await sql`INSERT INTO users (id, data) VALUES ('admin-001', ${adminData}::jsonb) ON CONFLICT (id) DO NOTHING`;
  }

  async read(table) {
    const sql = await this.connect();
    const rows = await sql`SELECT data FROM ${sql(table)}`;
    return rows.map(r => r.data);
  }

  async write(table, data) {
    const sql = await this.connect();
    await sql`DELETE FROM ${sql(table)}`;
    if (data && data.length > 0) {
      for (const item of data) {
        const id = item.id || Date.now().toString();
        await sql`INSERT INTO ${sql(table)} (id, data) VALUES (${id}, ${JSON.stringify(item)}::jsonb)`;
      }
    }
  }

  async test() {
    try {
      const sql = await this.connect();
      await sql`SELECT 1`;
      return { success: true, message: 'Neon PostgreSQL conectado!' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = NeonAdapter;
