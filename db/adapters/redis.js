/**
 * Redis Cloud Adapter
 * Dependencia: npm install redis
 * Gratuito: 30MB no Redis Cloud (redis.io/cloud)
 * URL: https://redis.io/cloud
 */

class RedisAdapter {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  async connect() {
    if (this.client && this.client.isReady) return this.client;
    const { createClient } = require('redis');
    this.client = createClient({
      url: this.config.url || ('redis://' + (this.config.host || 'localhost') + ':' + (this.config.port || 6379)),
      password: this.config.password || undefined
    });
    this.client.on('error', (err) => console.error('[Redis] Erro:', err.message));
    await this.client.connect();
    return this.client;
  }

  async init() {
    const client = await this.connect();
    const tables = ['users', 'animes', 'episodes', 'history', 'settings'];
    for (const t of tables) {
      const exists = await client.exists('json:' + t);
      if (!exists) {
        await client.set('json:' + t, '[]');
      }
    }
    const bcrypt = require('bcryptjs');
    const users = await this.read('users');
    if (!users.find(u => u.email === 'admin@otkanimes.com')) {
      users.push({
        id: 'admin-001', name: 'Administrador', email: 'admin@otkanimes.com',
        password: bcrypt.hashSync('admin123', 10), role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        createdAt: new Date().toISOString()
      });
      await this.write('users', users);
    }
  }

  async read(table) {
    const client = await this.connect();
    const raw = await client.get('json:' + table);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  async write(table, data) {
    const client = await this.connect();
    await client.set('json:' + table, JSON.stringify(data || []));
  }

  async test() {
    try {
      const client = await this.connect();
      await client.ping();
      return { success: true, message: 'Redis conectado!' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = RedisAdapter;
