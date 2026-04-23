/**
 * Supabase PostgreSQL Adapter
 * Dependencia: npm install @supabase/supabase-js
 * Gratuito: 500MB storage, 2GB transferencia
 * URL: https://supabase.com
 */

class SupabaseAdapter {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  async connect() {
    if (this.client) return this.client;
    const { createClient } = require('@supabase/supabase-js');
    this.client = createClient(this.config.url, this.config.anonKey);
    return this.client;
  }

  async init() {
    await this.connect();
    // Supabase precisa das tabelas criadas via SQL Editor
    // Este init apenas verifica se a tabela users existe
    const { data } = await this.client.from('users').select('id').limit(1);
    if (data === null || data.length === 0) {
      const bcrypt = require('bcryptjs');
      await this.client.from('users').insert([{
        id: 'admin-001', name: 'Administrador', email: 'admin@otkanimes.com',
        password: bcrypt.hashSync('admin123', 10), role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        createdAt: new Date().toISOString()
      }]);
    }
  }

  async read(table) {
    const client = await this.connect();
    const { data, error } = await client.from(table).select('*');
    if (error) throw new Error(error.message);
    return data || [];
  }

  async write(table, data) {
    const client = await this.connect();
    // Deleta tudo e reinsere
    const { data: existing } = await client.from(table).select('id');
    if (existing && existing.length > 0) {
      for (const row of existing) {
        await client.from(table).delete().eq('id', row.id);
      }
    }
    if (data && data.length > 0) {
      await client.from(table).insert(data);
    }
  }

  async test() {
    try {
      await this.connect();
      const { error } = await this.client.from('users').select('count', { count: 'exact', head: true });
      if (error) throw error;
      return { success: true, message: 'Supabase conectado!' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = SupabaseAdapter;
