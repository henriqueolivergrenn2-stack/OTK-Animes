/**
 * JSON Local Adapter - Padrao, dados salvos em arquivos .json
 * Sem dependencias externas
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

class JsonAdapter {
  constructor(config) {
    this.config = config;
    this.ensureDir();
  }

  ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _filePath(table) {
    return path.join(DATA_DIR, table + '.json');
  }

  async init() {
    this.ensureDir();
    // Cria users.json com admin se nao existir
    if (!fs.existsSync(this._filePath('users'))) {
      this.write('users', [{
        id: 'admin-001',
        name: 'Administrador',
        email: 'admin@otkanimes.com',
        password: bcrypt.hashSync('admin123', 10),
        role: 'admin',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        createdAt: new Date().toISOString()
      }]);
    }
    // Cria outros arquivos se nao existirem
    ['animes', 'episodes', 'history'].forEach(f => {
      if (!fs.existsSync(this._filePath(f))) this.write(f, []);
    });
    if (!fs.existsSync(this._filePath('settings'))) this.write('settings', {});
  }

  async read(table) {
    const fp = this._filePath(table);
    if (!fs.existsSync(fp)) return [];
    try {
      const raw = fs.readFileSync(fp, 'utf8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async write(table, data) {
    this.ensureDir();
    fs.writeFileSync(this._filePath(table), JSON.stringify(data, null, 2));
  }

  async test() {
    try {
      this.ensureDir();
      const testFile = this._filePath('_test');
      fs.writeFileSync(testFile, JSON.stringify({ ok: true }));
      fs.readFileSync(testFile, 'utf8');
      fs.unlinkSync(testFile);
      return { success: true, message: 'JSON local funcionando perfeitamente!' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = JsonAdapter;
