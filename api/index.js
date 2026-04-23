/**
 * Vercel Serverless Entry Point
 */
let handler = null;

module.exports = async (req, res) => {
  if (!handler) {
    const serverless = require('serverless-http');
    const app = require('../server.js');
    // Inicializa DB antes de criar handler
    const db = require('../db/manager');
    await db.initData();
    handler = serverless(app);
  }
  return handler(req, res);
};
