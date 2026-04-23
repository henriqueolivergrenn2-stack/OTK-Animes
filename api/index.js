let handler = null;

module.exports = async (req, res) => {
  try {
    if (!handler) {
      const serverless = require('serverless-http');
      const app = require('../server.js');

      // Inicializa o banco (se necessário)
      const db = require('../db/manager');
      await db.initData().catch(err => console.error('DB init error:', err));

      handler = serverless(app);
    }

    return await handler(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).send('Erro interno no servidor');
  }
};