/**
 * MongoDB Atlas Adapter
 * Dependencia: npm install mongodb
 * Gratuito: 512MB storage, 1M reads/mes no M0 cluster
 * URL: https://www.mongodb.com/atlas
 */

class MongoDBAdapter {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.db = null;
  }

  async connect() {
    if (this.db) return this.db;
    try {
      const { MongoClient } = require('mongodb');
      this.client = new MongoClient(this.config.connectionString, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000
      });
      await this.client.connect();
      this.db = this.client.db(this.config.database || 'otkanimes');
      return this.db;
    } catch (err) {
      throw new Error('MongoDB: ' + err.message);
    }
  }

  async init() {
    const db = await this.connect();
    // Garante que as collections existem
    const collections = ['users', 'animes', 'episodes', 'history', 'settings'];
    for (const col of collections) {
      const exists = await db.listCollections({ name: col }).hasNext();
      if (!exists) await db.createCollection(col);
    }
    // Cria admin padrao se nao existir
    const users = await db.collection('users').findOne({ email: 'admin@otkanimes.com' });
    if (!users) {
      const bcrypt = require('bcryptjs');
      await db.collection('users').insertOne({
        id: 'admin-001', name: 'Administrador', email: 'admin@otkanimes.com',
        password: bcrypt.hashSync('admin123', 10), role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        createdAt: new Date().toISOString()
      });
    }
  }

  async read(table) {
    const db = await this.connect();
    const docs = await db.collection(table).find({}).toArray();
    // Remove _id do MongoDB para compatibilidade
    return docs.map(d => { const { _id, ...rest } = d; return rest; });
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
}

module.exports = MongoDBAdapter;
