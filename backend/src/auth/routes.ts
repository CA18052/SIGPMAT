import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import argon2 from 'argon2';
import { pool } from '../db.js';

type AccountRow = {
  id_usuario: string;
  nombre_usuario: string;
  estado: string;
  contrasena_hash: string;
};

type AccountPublic = {
  id_usuario: string;
  nombre_usuario: string;
  roles: string[];
};

type LoginBody = {
  nombre_usuario: string;
  contrasena: string;
};

// Homogeneiza aproximadamente el costo cuando el usuario no existe.
// Este hash NO corresponde a una cuenta válida.
const dummyHash = await argon2.hash('sigpmat-invalid-user-placeholder', {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
});

async function rolesVigentes(id: string): Promise<string[]> {
  const { rows } = await pool.query<{ codigo: string }>(
    `SELECT r.codigo
       FROM sigpmat.usuario_roles ur
       JOIN sigpmat.roles r ON r.id_rol = ur.id_rol
      WHERE ur.id_usuario = $1::bigint AND r.activo = TRUE
      ORDER BY r.codigo`,
    [id]
  );
  return rows.map((row) => row.codigo);
}

export async function autorizar(
  request: FastifyRequest,
  reply: FastifyReply,
  rolNecesario?: string
): Promise<AccountPublic | null> {
  let sub: unknown;
  try {
    const claims = await request.jwtVerify();
    sub = (claims as { sub?: unknown }).sub;
  } catch {
    reply.code(401).send({ error: 'Autenticacion requerida' });
    return null;
  }

  if (typeof sub !== 'string' || !/^\d+$/.test(sub)) {
    reply.code(401).send({ error: 'Token invalido' });
    return null;
  }

  // Consultar DB en cada solicitud permite revocar el acceso al bloquear
  // una cuenta o quitar un rol, incluso si el JWT aun no ha expirado.
  const { rows } = await pool.query<{
    id_usuario: string;
    nombre_usuario: string;
    estado: string;
  }>(
    `SELECT id_usuario::text, nombre_usuario, estado
       FROM sigpmat.usuarios WHERE id_usuario = $1::bigint`,
    [sub]
  );
  const account = rows[0];
  if (!account || account.estado !== 'activa') {
    reply.code(401).send({ error: 'Cuenta no habilitada' });
    return null;
  }

  const roles = await rolesVigentes(account.id_usuario);
  if (roles.length === 0 || (rolNecesario && !roles.includes(rolNecesario))) {
    reply.code(403).send({ error: 'Acceso no autorizado' });
    return null;
  }
  return {
    id_usuario: account.id_usuario,
    nombre_usuario: account.nombre_usuario,
    roles
  };
}

export function registrarRutasAutenticacion(app: FastifyInstance): void {
  app.post<{ Body: LoginBody }>(
    '/api/auth/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          required: ['nombre_usuario', 'contrasena'],
          additionalProperties: false,
          properties: {
            nombre_usuario: { type: 'string', minLength: 1, maxLength: 50 },
            contrasena: { type: 'string', minLength: 1, maxLength: 128 }
          }
        }
      }
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const { nombre_usuario, contrasena } = request.body;
      const { rows } = await pool.query<AccountRow>(
        `SELECT id_usuario::text, nombre_usuario, estado, contrasena_hash
           FROM sigpmat.usuarios WHERE nombre_usuario = $1`,
        [nombre_usuario.trim()]
      );
      const account = rows[0];
      if (!account) {
        await argon2.verify(dummyHash, contrasena);
        return reply.code(401).send({ error: 'Credenciales invalidas' });
      }

      let correct = false;
      try {
        correct = await argon2.verify(account.contrasena_hash, contrasena);
      } catch {
        // Cuenta historica sin un hash compatible: error generico al cliente.
        request.log.warn('Hash de credenciales no compatible');
      }
      if (!correct || account.estado !== 'activa') {
        return reply.code(401).send({ error: 'Credenciales invalidas' });
      }
      const roles = await rolesVigentes(account.id_usuario);
      if (roles.length === 0) {
        return reply.code(403).send({ error: 'Acceso no autorizado' });
      }

      await pool.query(
        `UPDATE sigpmat.usuarios SET ultimo_acceso_at = now()
          WHERE id_usuario = $1::bigint`,
        [account.id_usuario]
      );
      const token = await reply.jwtSign(
        { sub: account.id_usuario },
        { expiresIn: '15m' }
      );
      return reply.send({
        access_token: token,
        token_type: 'Bearer',
        expires_in_seconds: 900,
        usuario: {
          id_usuario: account.id_usuario,
          nombre_usuario: account.nombre_usuario,
          roles
        }
      });
    }
  );

  app.get('/api/auth/me', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const usuario = await autorizar(request, reply);
    if (!usuario) return reply;
    return { usuario };
  });

  app.get('/api/admin/ping', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const usuario = await autorizar(request, reply, 'ADMIN_GENERAL');
    if (!usuario) return reply;
    return { status: 'ok', acceso: 'ADMIN_GENERAL', usuario: usuario.nombre_usuario };
  });
}
