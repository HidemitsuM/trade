#!/usr/bin/env node
import { Database } from '@trade/core';
import { startDashboard } from './server.js';

const dbPath = process.env.DB_PATH || './data/trade.db';
let db: Database | null = null;
try {
  db = new Database(dbPath);
  db.initialize();
} catch (err) {
  console.error('Failed to initialize database:', err);
  db = null;
}
startDashboard(db);
