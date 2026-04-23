let handler = null;

module.exports = async (req, res) => {
  try {
    if (!handler) {
      console.log('🔄 Cold start: inicializando app...');
      
      const serverless = require('serverless-http');
      const app = require('../server.js');

      // Remova ou comente esta linha se db.initData() já roda dentro do server.js
      // const db = require('../db/manager');
      // await db.initData().catch(err => console.error('DB init error:', err));

      handler = serverless(app);
      console.log('✅ App inicializado com sucesso');
    }

    return await handler(req, res);
  } catch (error) {
    console.error('❌ Erro no handler:', error);
    res.status(500).send('Erro interno no servidor');
  }
};