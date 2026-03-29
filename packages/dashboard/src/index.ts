#!/usr/bin/env node
import { Database } from '@trade/core';
import { startDashboard } from './server.js';

const dbPath = process.env.DB_PATH || './data/trade.db';
const db = new Database(dbPath);
db.initialize();
startDashboard(db);
