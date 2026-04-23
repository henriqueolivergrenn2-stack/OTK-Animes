/**
 * Firebase Firestore Adapter
 * Dependencia: npm install firebase-admin
 * Gratuito: 1GB storage, 50K reads/dia no Spark plan
 * URL: https://firebase.google.com
 */

class FirebaseAdapter {
  constructor(config) {
    this.config = config;
    this.initialized = false;
  }

  async initApp() {
    if (this.initialized) return;
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(this.config.serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: this.config.databaseURL
      });
    }
    this.db = admin.firestore();
    this.initialized = true;
  }

  async init() {
    await this.initApp();
    const usersSnap = await this.db.collection('users').where('email', '==', 'admin@otkanimes.com').limit(1).get();
    if (usersSnap.empty) {
      const bcrypt = require('bcryptjs');
      await this.db.collection('users').add({
        id: 'admin-001', name: 'Administrador', email: 'admin@otkanimes.com',
        password: bcrypt.hashSync('admin123', 10), role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        createdAt: new Date().toISOString()
      });
    }
  }

  async read(table) {
    await this.initApp();
    const snapshot = await this.db.collection(table).get();
    return snapshot.docs.map(d => d.data());
  }

  async write(table, data) {
    await this.initApp();
    const batch = this.db.batch();
    const snapshot = await this.db.collection(table).get();
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    if (data && data.length > 0) {
      const newBatch = this.db.batch();
      data.forEach(item => {
        const ref = this.db.collection(table).doc();
        newBatch.set(ref, item);
      });
      await newBatch.commit();
    }
  }

  async test() {
    try {
      await this.initApp();
      await this.db.collection('_test').doc('ping').set({ time: Date.now() });
      return { success: true, message: 'Firebase Firestore conectado!' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = FirebaseAdapter;
