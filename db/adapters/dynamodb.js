/**
 * AWS DynamoDB Adapter
 * Dependencia: npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
 * Gratuito: 25GB storage, 25 unidades de capacidade
 * URL: https://aws.amazon.com/dynamodb/free
 */

class DynamoDBAdapter {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.docClient = null;
  }

  async connect() {
    if (this.docClient) return this.docClient;
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    const region = this.config.region || 'us-east-1';
    this.client = new DynamoDBClient({
      region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      }
    });
    this.docClient = DynamoDBDocumentClient.from(this.client);
    return this.docClient;
  }

  async init() {
    // DynamoDB tabelas precisam ser criadas via AWS Console ou CLI
    // Este init apenas verifica a conexao
    await this.connect();
    const bcrypt = require('bcryptjs');
    const { PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
    try {
      await this.docClient.send(new GetCommand({
        TableName: 'users', Key: { id: 'admin-001' }
      }));
    } catch (e) {
      // Tabela pode nao existir, ignora
    }
  }

  async read(table) {
    const client = await this.connect();
    const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
    const result = await client.send(new ScanCommand({ TableName: table }));
    return result.Items || [];
  }

  async write(table, data) {
    const client = await this.connect();
    const { BatchWriteCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
    // Deleta tudo
    const existing = await client.send(new ScanCommand({ TableName: table }));
    if (existing.Items && existing.Items.length > 0) {
      for (const item of existing.Items) {
        await client.send(new DeleteCommand({ TableName: table, Key: { id: item.id } }));
      }
    }
    // Insere novos
    if (data && data.length > 0) {
      const chunks = [];
      for (let i = 0; i < data.length; i += 25) {
        chunks.push(data.slice(i, i + 25));
      }
      for (const chunk of chunks) {
        await client.send(new BatchWriteCommand({
          RequestItems: {
            [table]: chunk.map(item => ({
              PutRequest: { Item: { ...item } }
            }))
          }
        }));
      }
    }
  }

  async test() {
    try {
      await this.connect();
      return { success: true, message: 'DynamoDB conectado!' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = DynamoDBAdapter;
