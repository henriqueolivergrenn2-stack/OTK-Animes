/**
 * MongoDB Atlas Adapter
 * Dependencia: npm install mongodb
 * Gratuito: 512MB storage, 1M reads/mes no M0 cluster
 * URL: https://www.mongodb.com/atlas
 */

class MongoDBAdapter {
  constructor(config) {
    this.config = config || {};
    this.client = null;
    this.db = null;
  }

  async connect() {
    if (this.db) return this.db;

    // ===== VALIDACAO: evita o erro "startsWith of undefined" =====
    const uri = this.config.connectionString || this.config.uri || this.config.url;
    if (!uri || typeof uri !== 'string' || uri.trim() === '') {
      throw new Error(
        'MongoDB: connectionString nao configurada ou invalida. ' +
        'Acesse /admin/database > MongoDB > Configurar e insira sua connection string do Atlas.'
      );
    }
    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
      throw new Error(
        'MongoDB: connectionString invalida. Deve comecar com "mongodb://" ou "mongodb+srv://". ' +
        'Copie a string correta do MongoDB Atlas.'
      );
    }
    // ============================================================

    try {
      const { MongoClient } = require('mongodb');
      this.client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        socketTimeoutMS: 8000
      });
      await this.client.connect();
      this.db = this.client.db(this.config.database || 'otkanimes');
      console.log('[MongoDB] Conectado com sucesso ao banco:', this.config.database || 'otkanimes');
      return this.db;
    } catch (err) {
      this.client = null;
      this.db = null;
      throw new Error('MongoDB: ' + err.message);
    }
  }

  async init() {
    const db = await this.connect();
    const collections = ['users', 'animes', 'episodes', 'history', 'settings'];
    for (const col of collections) {
      const exists = await db.listCollections({ name: col }).hasNext();
      if (!exists) await db.createCollection(col);
    }
    // Cria admin padrao se nao existir
    const adminExists = await db.collection('users').findOne({ email: 'admin@otkanimes.com' });
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      await db.collection('users').insertOne({
        id: 'admin-001', name: 'Administrador', email: 'admin@otkanimes.com',
        password: bcrypt.hashSync('admin123', 10), role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        createdAt: new Date().toISOString()
      });
      console.log('[MongoDB] Admin padrao criado: admin@otkanimes.com / admin123');
    }
  }

  async read(table) {
    const db = await this.connect();
    const docs = await db.collection(table).find({}).toArray();
    // Remove _id do MongoDB para compatibilidade com o restante do sistema
    return docs.map(({ _id, ...rest }) => rest);
  }

  async write(table, data) {
    const db = await this.connect();
    const collection = db.collection(table);
    await collection.deleteMany({});
    if (data && data.length > 0) {
      await collection.insertMany(data);
    }
  }

  async test() {
    try {
      await this.connect();
      await this.db.admin().ping();
      return { success: true, message: 'MongoDB Atlas conectado com sucesso!' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.db = null;
      }
    } catch (_) {}
  }
}

module.exports = MongoDBAdapter;
