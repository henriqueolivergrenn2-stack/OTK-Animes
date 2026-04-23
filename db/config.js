/**
 * DB Config Manager - Gerencia configuracoes de banco de dados
 * Salva em data/dbconfig.json
 */
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'dbconfig.json');
const DATA_DIR = path.join(__dirname, '..', 'data');

// Default config = JSON local
const DEFAULT_CONFIG = {
  activeProvider: 'json',
  providers: {
    json: { enabled: true, label: 'JSON Local (Padrao)', description: 'Dados salvos em arquivos .json na pasta data/' },
    mongodb: { enabled: false, label: 'MongoDB Atlas', description: 'Banco NoSQL gratuito da MongoDB' },
    firebase: { enabled: false, label: 'Firebase Firestore', description: 'Banco NoSQL do Google (Spark plan gratuito)' },
    supabase: { enabled: false, label: 'Supabase PostgreSQL', description: 'PostgreSQL gratuito com API REST' },
    planetscale: { enabled: false, label: 'PlanetScale MySQL', description: 'MySQL serverless gratuito' },
    neon: { enabled: false, label: 'Neon PostgreSQL', description: 'PostgreSQL serverless gratuito' },
    mysql: { enabled: false, label: 'MySQL', description: 'MySQL proprio (local, RDS, etc)' },
    postgres: { enabled: false, label: 'PostgreSQL', description: 'PostgreSQL proprio (local, RDS, etc)' },
    sqlite: { enabled: false, label: 'SQLite Local', description: 'Banco SQLite local (.db file)' },
    redis: { enabled: false, label: 'Redis Cloud', description: 'Cache/DB Redis gratuito' },
    dynamodb: { enabled: false, label: 'AWS DynamoDB', description: 'NoSQL da AWS (free tier)' },
    cockroachdb: { enabled: false, label: 'CockroachDB', description: 'PostgreSQL distribuido gratuito' }
  }
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadConfig() {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    // Merge com defaults para garantir que novos providers aparecam
    const merged = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    if (saved.activeProvider) merged.activeProvider = saved.activeProvider;
    if (saved.providers) {
      Object.keys(saved.providers).forEach(k => {
        if (merged.providers[k]) {
          merged.providers[k] = { ...merged.providers[k], ...saved.providers[k] };
        }
      });
    }
    return merged;
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

function saveConfig(config) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getActiveProvider() {
  const cfg = loadConfig();
  return cfg.activeProvider || 'json';
}

function setActiveProvider(provider) {
  const cfg = loadConfig();
  cfg.activeProvider = provider;
  saveConfig(cfg);
}

function getProviderConfig(provider) {
  const cfg = loadConfig();
  return cfg.providers[provider] || null;
}

function updateProviderConfig(provider, settings) {
  const cfg = loadConfig();
  if (!cfg.providers[provider]) return false;
  cfg.providers[provider] = { ...cfg.providers[provider], ...settings };
  saveConfig(cfg);
  return true;
}

function getAllProviders() {
  const cfg = loadConfig();
  return cfg.providers;
}

module.exports = {
  loadConfig,
  saveConfig,
  getActiveProvider,
  setActiveProvider,
  getProviderConfig,
  updateProviderConfig,
  getAllProviders,
  DEFAULT_CONFIG
};
