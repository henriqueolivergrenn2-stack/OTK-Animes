/**
 * DB Config Manager - Gerencia configuracoes de banco de dados
 * Salva em data/dbconfig.json
 */
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'dbconfig.json');
const DATA_DIR = path.join(__dirname, '..', 'data');

// ===== DETECCAO DE AMBIENTE =====
// Vercel injeta VERCEL=1 automaticamente.
// NAO usa !fs.existsSync(DATA_DIR) como criterio — isso causava bug no Termux
// na primeira execucao antes de a pasta data/ ser criada.
const IS_SERVERLESS = process.env.VERCEL === '1' || process.env.IS_SERVERLESS === '1';

// Default config
const DEFAULT_CONFIG = {
  activeProvider: IS_SERVERLESS ? 'memory' : 'json',
  providers: {
    memory: { enabled: true, label: 'Memory (Serverless)', description: 'Dados em RAM - ideal para Vercel/serverless sem disco' },
    json: { enabled: true, label: 'JSON Local (Padrao)', description: 'Dados salvos em arquivos .json na pasta data/' },
    mongodb: { enabled: false, label: 'MongoDB Atlas', description: 'Banco NoSQL gratuito da MongoDB', connectionString: '', database: 'otkanimes' },
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
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[Config] Nao foi possivel criar pasta data/:', err.message);
  }
}

function loadConfig() {
  // Serverless: usa memory sempre, sem tocar no disco
  if (IS_SERVERLESS) {
    // Mas permite MongoDB via variavel de ambiente na Vercel
    const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    if (process.env.MONGODB_URI) {
      cfg.activeProvider = 'mongodb';
      cfg.providers.mongodb = {
        ...cfg.providers.mongodb,
        enabled: true,
        connectionString: process.env.MONGODB_URI,
        database: process.env.MONGODB_DB || 'otkanimes'
      };
    } else {
      cfg.activeProvider = 'memory';
    }
    return cfg;
  }

  ensureDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultCopy, null, 2));
    } catch (err) {
      console.error('[Config] Erro ao criar dbconfig.json:', err.message);
    }
    return defaultCopy;
  }

  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
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
    console.error('[Config] Erro ao ler dbconfig.json, usando padrao:', e.message);
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

function saveConfig(config) {
  if (IS_SERVERLESS) return;
  ensureDir();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('[Config] Erro ao salvar dbconfig.json:', err.message);
  }
}

function getActiveProvider() {
  if (IS_SERVERLESS) {
    return process.env.MONGODB_URI ? 'mongodb' : 'memory';
  }
  const cfg = loadConfig();
  return cfg.activeProvider || 'json';
}

function setActiveProvider(provider) {
  if (IS_SERVERLESS) return;
  const cfg = loadConfig();
  cfg.activeProvider = provider;
  saveConfig(cfg);
}

function getProviderConfig(provider) {
  const cfg = loadConfig();
  return cfg.providers[provider] || null;
}

function updateProviderConfig(provider, settings) {
  if (IS_SERVERLESS) return true;
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
  DEFAULT_CONFIG,
  IS_SERVERLESS
};
