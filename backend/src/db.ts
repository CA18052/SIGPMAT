import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  host: config.pgHost,
  port: config.pgPort,
  database: config.pgDatabase,
  user: config.pgUser,
  password: config.pgPassword,
  max: 5,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 10000
});
