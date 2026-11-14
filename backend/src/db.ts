import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

function connectionOptions(): pg.PoolConfig {
  if (config.databaseUrl) {
    const url = new URL(config.databaseUrl);
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
      throw new Error('DATABASE_URL no es una conexión PostgreSQL válida');
    }
    // La conexión TLS se configura aquí para verificar el certificado del servidor.
    // Eliminamos estas opciones de la URL para que no sobrescriban el ajuste de Node.
    for (const parametro of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) {
      url.searchParams.delete(parametro);
    }
    return {
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: true },
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000
    };
  }

  return {
    host: config.pgHost,
    port: config.pgPort,
    database: config.pgDatabase,
    user: config.pgUser,
    password: config.pgPassword,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000
  };
}

export const pool = new Pool(connectionOptions());
