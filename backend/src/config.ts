import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error('Falta la variable de entorno: ' + name);
  return value;
}

const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;

export const config = {
  appPort: Number(process.env.PORT ?? process.env.APP_PORT ?? 3001),
  appHost: process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1',
  databaseUrl,
  pgHost: databaseUrl ? undefined : required('PGHOST'),
  pgPort: databaseUrl ? undefined : Number(required('PGPORT')),
  pgDatabase: databaseUrl ? undefined : required('PGDATABASE'),
  pgUser: databaseUrl ? undefined : required('PGUSER'),
  pgPassword: databaseUrl ? undefined : required('PGPASSWORD')
};

if (!Number.isInteger(config.appPort) || config.appPort < 1 || config.appPort > 65535) {
  throw new Error('El puerto HTTP no es válido');
}
if (config.pgPort !== undefined &&
    (!Number.isInteger(config.pgPort) || config.pgPort < 1 || config.pgPort > 65535)) {
  throw new Error('El puerto de PostgreSQL no es válido');
}
