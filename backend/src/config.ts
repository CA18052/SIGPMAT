import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Falta la variable de entorno: ${name}`
    );
  }

  return value;
}

export const config = {
  appPort: Number(required('APP_PORT')),
  pgHost: required('PGHOST'),
  pgPort: Number(required('PGPORT')),
  pgDatabase: required('PGDATABASE'),
  pgUser: required('PGUSER'),
  pgPassword: required('PGPASSWORD')
};

if (
  !Number.isInteger(config.appPort) ||
  config.appPort < 1 ||
  config.appPort > 65535 ||
  !Number.isInteger(config.pgPort) ||
  config.pgPort < 1 ||
  config.pgPort > 65535
) {
  throw new Error('Configuracion de puertos invalida');
}
