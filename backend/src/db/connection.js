import { Sequelize } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables in this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../../.env');

dotenv.config({ path: envPath });

/**
 * Database Connection Setup
 * Supports both SQLite (local development) and MySQL (production)
 */

let sequelize;

try {
  const dialect = process.env.DB_DIALECT || 'sqlite';
  console.log(`🗄️  Database Dialect: ${dialect}`);
  console.log(`📋 Database Config:`);
  console.log(`  DB_NAME: ${process.env.DB_NAME || 'Not set'}`);
  console.log(`  DB_HOST: ${process.env.DB_HOST || '(SQLite - N/A)'}`);

  if (dialect === 'sqlite') {
    // SQLite configuration for local development
    const dbPath = path.join(__dirname, '../../', process.env.DB_NAME || 'database.db');
    console.log(`📁 SQLite Database Path: ${dbPath}`);
    
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      define: {
        timestamps: true,
        underscored: false,
      },
      // Enable foreign key support for SQLite
      dialectOptions: {
        // This enables foreign key constraints
        foreign_keys: true,
      },
    });
  } else {
    // MySQL/MariaDB configuration for production
    console.log(`🔌 Connecting to ${dialect}: ${process.env.DB_USER}@${process.env.DB_HOST}/${process.env.DB_NAME}`);
    
    sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      dialect: dialect,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      timezone: '+00:00', // UTC
    });
  }
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
    
    // Enable foreign key constraints for SQLite
    if (process.env.DB_DIALECT === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON');
      console.log('✅ Foreign key constraints enabled for SQLite');
    }
    
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
