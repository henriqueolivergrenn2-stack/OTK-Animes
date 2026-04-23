/**
 * DB Manager - Carrega adapter ativo com lazy require
 * Nao crasha se dependencias opcionais nao estiverem instaladas
 */
const path = require('path');
const { getActiveProvider, getProviderConfig } = require('./config');

let currentAdapter = null;
let currentProvider = null;

function loadAdapter() {
  const provider = getActiveProvider();
  if (currentAdapter && currentProvider === provider) {
    return currentAdapter;
  }

  try {
    const adapterPath = path.join(__dirname, 'adapters', provider + '.js');
    const AdapterClass = require(adapterPath);
    const config = getProviderConfig(provider) || {};
    const adapter = new AdapterClass(config);
    currentAdapter = adapter;
    currentProvider = provider;
    return adapter;
  } catch (err) {
    console.error('[DB] Falha ao carregar adapter "' + provider + '":', err.message);
    console.error('[DB] Usando JSON local como fallback');
    try {
      const JsonAdapter = require('./adapters/json.js');
      currentAdapter = new JsonAdapter({});
      currentProvider = 'json';
      return currentAdapter;
    } catch (fallbackErr) {
      console.error('[DB] Falha no fallback JSON:', fallbackErr.message);
      // Retorna um adapter nulo seguro para nao derrubar o servidor
      return createNullAdapter();
    }
  }
}

// Adapter nulo de emergencia — retorna arrays vazios sem crashar
function createNullAdapter() {
  return {
    read: async () => [],
    write: async () => {},
    init: async () => {},
    test: async () => ({ success: false, message: 'Nenhum adapter disponivel' })
  };
}

async function readJSON(table) {
  try {
    const result = await loadAdapter().read(table);
    return Array.isArray(result) ? result : (result || []);
  } catch (err) {
    console.error('[DB] readJSON("' + table + '") erro:', err.message);
    return [];
  }
}

async function writeJSON(table, data) {
  try {
    return await loadAdapter().write(table, data);
  } catch (err) {
    console.error('[DB] writeJSON("' + table + '") erro:', err.message);
  }
}

async function initData() {
  try {
    await loadAdapter().init();
  } catch (err) {
    console.error('[DB] initData erro:', err.message);
    // Nao re-lanca o erro — deixa o servidor subir mesmo assim
  }
}

async function testConnection(provider, config) {
  // Valida antes de tentar carregar o adapter
  if (!provider || typeof provider !== 'string') {
    return { success: false, message: 'Provider invalido.' };
  }
  if (!config || typeof config !== 'object') {
    return { success: false, message: 'Configuracao invalida.' };
  }

  try {
    const adapterPath = path.join(__dirname, 'adapters', provider + '.js');
    const AdapterClass = require(adapterPath);
    const adapter = new AdapterClass(config);
    return await adapter.test();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getCurrentProvider() {
  return currentProvider || getActiveProvider();
}

function reloadAdapter() {
  // Limpa cache do require para o adapter atual poder ser recarregado
  if (currentProvider) {
    const adapterPath = path.join(__dirname, 'adapters', currentProvider + '.js');
    try { delete require.cache[require.resolve(adapterPath)]; } catch (_) {}
  }
  currentAdapter = null;
  currentProvider = null;
  return loadAdapter();
}

module.exports = {
  readJSON,
  writeJSON,
  initData,
  testConnection,
  getCurrentProvider,
  reloadAdapter
};
