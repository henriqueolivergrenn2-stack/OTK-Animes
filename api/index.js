/**
 * Vercel Serverless Entry Point
 * Exporta o app Express como serverless function
 */
const app = require('../server.js');
module.exports = app;
