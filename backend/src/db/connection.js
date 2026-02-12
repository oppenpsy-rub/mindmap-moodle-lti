import { Sequelize } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database Connection Setup
 * Connects to All-Inkl MySQL database
 */

let sequelize;

try {
  const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  console.log(`🔌 Connecting to MySQL database: ${dbConfig.user}@${dbConfig.host}/${dbConfig.database}`);

  sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    timezone: '+00:00', // UTC
  });
} catch (error) {
  console.error('❌ Database connection error:', error.message);
  process.exit(1);
}

/**
 * Test connection
 */
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to database:', error.message);
    return false;
  }
}

/**
 * Sync database schema
 */
async function syncDatabase() {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Database tables synced!');
  } catch (error) {
    console.error('❌ Database sync error:', error.message);
    throw error;
  }
}

export { sequelize, testConnection, syncDatabase };
