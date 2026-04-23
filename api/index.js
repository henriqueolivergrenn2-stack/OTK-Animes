/**
 * Vercel Serverless Entry Point - Versão otimizada
 */

let handler = null;

module.exports = async (req, res) => {
  try {
    if (!handler) {
      console.log('🔄 Inicializando handler pela primeira vez (cold start)...');

      // Carrega o app Express
      const app = require('../server.js');

      // Inicializa o banco de dados ANTES de criar o handler
      const db = require('../db/manager');
      await db.initData();

      // Cria o handler com serverless-http
      const serverless = require('serverless-http');
      handler = serverless(app, {
        // Opções recomendadas para melhor compatibilidade
        binary: ['image/*', 'application/octet-stream'],
        // Pode adicionar mais configurações se precisar
      });

      console.log('✅ Handler inicializado com sucesso');
    }

    // Executa o handler
    return await handler(req, res);

  } catch (error) {
    console.error('❌ Erro no handler Vercel:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' 
        ? 'Algo deu errado no servidor' 
        : error.message
    });
  }
};