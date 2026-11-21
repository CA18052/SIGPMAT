import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { autorizar } from './auth/routes.js';
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
import { registrarCrudGestion } from './gestion/crud.js';
import { registrarRutasUsuarios } from './usuarios/routes.js';
import { registrarSeguridadOperaciones } from './seguridad/routes.js';
import { registrarRutasReportes } from './reportes/routes.js';

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
  reply.header('Cache-Control', 'no-store');
  const usuario = await autorizar(request, reply, 'ADMIN_GENERAL');
  if (!usuario) return reply;
  try {
    const result = await pool.query<{ total_tablas: number }>(`
      SELECT COUNT(*)::integer AS total_tablas
      FROM information_schema.tables
      WHERE table_schema = 'sigpmat' AND table_type = 'BASE TABLE'
    `);
    const totalTablas = result.rows[0]?.total_tablas ?? 0;
    if (totalTablas !== 26) {
      return reply.code(503).send({
        status: 'degraded', database: 'connected',
        expectedTables: 26, actualTables: totalTablas
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

registrarSeguridadOperaciones(app);
registrarRutasAutenticacion(app);
registrarRutasDepartamentos(app);
registrarRutasEmpleados(app);
registrarRutasPersonalV05(app);
registrarRutasTurnos(app);
registrarCrudGestion(app);
registrarRutasUsuarios(app);
registrarRutasReportes(app);

// En Render, Fastify entrega también los archivos compilados de React.
// En desarrollo, Vite sigue funcionando de forma independiente en el puerto 5173.
if (process.env.NODE_ENV === 'production') {
  const webRoot = resolve(process.cwd(), 'frontend', 'dist');
  const tipos: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
  };

  const servirReact = async (request: FastifyRequest, reply: FastifyReply) => {
    let ruta: string;
    try {
      ruta = decodeURIComponent(
        new URL(request.raw.url ?? '/', 'http://localhost').pathname
      );
    } catch {
      return reply.code(400).send({ error: 'Ruta no válida' });
    }

    if (ruta === '/api' || ruta.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Ruta de API no encontrada' });
    }
    if (ruta.includes('\\') || ruta.includes('\0')) {
      return reply.code(400).send({ error: 'Ruta no válida' });
    }
    const nombre = ruta === '/' ? 'index.html' : ruta.replace(/^\/+/, '');
    const archivo = resolve(webRoot, nombre);
    if (!archivo.startsWith(webRoot + sep)) {
      return reply.code(404).send({ error: 'Archivo no encontrado' });
    }

    let rutaArchivo = archivo;
    try {
      const info = await stat(rutaArchivo);
      if (!info.isFile()) throw new Error('No es un archivo');
    } catch {
      // Las rutas internas de React reciben index.html, no una página 404.
      if (extname(nombre)) {
        return reply.code(404).send({ error: 'Archivo no encontrado' });
      }
      rutaArchivo = resolve(webRoot, 'index.html');
    }

    try {
      const contenido = await readFile(rutaArchivo);
      const extension = extname(rutaArchivo).toLowerCase();
      reply.header('Content-Type', tipos[extension] ?? 'application/octet-stream');
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control',
        rutaArchivo.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600');
      return reply.send(contenido);
    } catch (error) {
      request.log.error({ err: error }, 'No se pudo entregar el frontend');
      return reply.code(503).send({ error: 'Interfaz no disponible' });
    }
  };

  app.get('/', servirReact);
  app.get('/*', servirReact);
}

app.addHook('onClose', async () => { await pool.end(); });

try {
  await app.listen({ port: config.appPort, host: config.appHost });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
