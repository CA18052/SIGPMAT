import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { pool } from './db.js';
import { registrarRutasAutenticacion } from './auth/routes.js';
import { registrarRutasDepartamentos } from './departamentos/routes.js';
import { registrarRutasEmpleados } from './empleados/routes.js';
import { registrarRutasPersonalV05 } from './personal/routes.js';
import { registrarRutasTurnos } from './turnos/routes.js';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || !/^[0-9a-f]{96}$/.test(jwtSecret)) {
  throw new Error('JWT_SECRET debe ser un secreto hexadecimal de 48 bytes en .env');
}

const app = Fastify({ logger: true });
await app.register(jwt, {
  secret: jwtSecret,
  sign: { algorithm: 'HS256', expiresIn: '15m' },
  verify: { algorithms: ['HS256'] }
});
await app.register(rateLimit, { global: false });

app.get('/api/health', async () => ({
  status: 'ok', service: 'SIGPMAT API', version: '0.6.0'
}));

app.get('/api/health/db', async (request, reply) => {
  try {
    const result = await pool.query<{ total_tablas: number }>(`
      SELECT COUNT(*)::integer AS total_tablas
      FROM information_schema.tables
      WHERE table_schema = 'sigpmat' AND table_type = 'BASE TABLE'
    `);
    const totalTablas = result.rows[0]?.total_tablas ?? 0;
    if (totalTablas !== 24) {
      return reply.code(503).send({
        status: 'degraded', database: 'connected',
        expectedTables: 24, actualTables: totalTablas
      });
    }
    return {
      status: 'ok', database: 'connected', schema: 'sigpmat', tables: totalTablas
    };
  } catch (error) {
    request.log.error({ err: error }, 'Error al comprobar PostgreSQL');
    return reply.code(503).send({ status: 'error', database: 'unavailable' });
  }
});

registrarRutasAutenticacion(app);
registrarRutasDepartamentos(app);
registrarRutasEmpleados(app);
registrarRutasPersonalV05(app);
registrarRutasTurnos(app);
app.addHook('onClose', async () => { await pool.end(); });

try {
  await app.listen({ port: config.appPort, host: '127.0.0.1' });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
