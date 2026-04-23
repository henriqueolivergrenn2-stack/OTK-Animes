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
    const JsonAdapter = require('./adapters/json.js');
    currentAdapter = new JsonAdapter({});
    currentProvider = 'json';
    return currentAdapter;
  }
}

async function readJSON(table) {
  try {
    return await loadAdapter().read(table);
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
  }
}

async function testConnection(provider, config) {
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
