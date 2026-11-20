import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import argon2 from 'argon2';
import { pool } from '../db.js';

type AccountRow = {
  id_usuario: string;
  nombre_usuario: string;
  estado: string;
  contrasena_hash: string;
  nombre_mostrado: string | null;
  tipo_cuenta: 'demo' | 'integrante' | 'docente';
  es_superadministrador: boolean;
  debe_cambiar_contrasena: boolean;
  sesion_version: number;
};

type AccountPublic = {
  id_usuario: string;
  nombre_usuario: string;
  roles: string[];
  nombre_mostrado: string | null;
  tipo_cuenta: string;
  es_superadministrador: boolean;
  debe_cambiar_contrasena: boolean;
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
  let sesionVersion: unknown;
  try {
    const claims = await request.jwtVerify();
    sub = (claims as { sub?: unknown }).sub;
    sesionVersion = (claims as { sv?: unknown }).sv;
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
    nombre_mostrado: string | null;
    tipo_cuenta: string;
    es_superadministrador: boolean;
    debe_cambiar_contrasena: boolean;
    sesion_version: number;
  }>(
    `SELECT id_usuario::text, nombre_usuario, estado,
            nombre_mostrado, tipo_cuenta, es_superadministrador,
            debe_cambiar_contrasena, sesion_version
       FROM sigpmat.usuarios WHERE id_usuario = $1::bigint`,
    [sub]
  );
  const account = rows[0];
  if (!account || account.estado !== 'activa') {
    reply.code(401).send({ error: 'Cuenta no habilitada' });
    return null;
  }

  if ((sesionVersion ?? 0) !== account.sesion_version) {
    reply.code(401).send({ error: 'La sesión ya no está vigente. Inicia sesión nuevamente.' });
    return null;
  }
  // Un usuario con clave temporal sólo puede consultar su identidad y
  // cambiar esa contraseña, no utilizar directamente la API de negocio.
  if (account.debe_cambiar_contrasena && request.url.split('?')[0] !== '/api/auth/me') {
    reply.code(403).send({
      error: 'Debes cambiar tu contraseña temporal antes de continuar.',
      codigo: 'CAMBIO_CONTRASENA_OBLIGATORIO'
    });
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
    roles,
    nombre_mostrado: account.nombre_mostrado,
    tipo_cuenta: account.tipo_cuenta,
    es_superadministrador: account.es_superadministrador,
    debe_cambiar_contrasena: account.debe_cambiar_contrasena
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
        `SELECT id_usuario::text, nombre_usuario, estado, contrasena_hash,
                 nombre_mostrado, tipo_cuenta, es_superadministrador,
                 debe_cambiar_contrasena, sesion_version
           FROM sigpmat.usuarios WHERE lower(nombre_usuario) = lower($1)`,
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
        { sub: account.id_usuario, sv: account.sesion_version },
        { expiresIn: '15m' }
      );
      return reply.send({
        access_token: token,
        token_type: 'Bearer',
        expires_in_seconds: 900,
        usuario: {
          id_usuario: account.id_usuario,
          nombre_usuario: account.nombre_usuario,
          roles,
          nombre_mostrado: account.nombre_mostrado,
          tipo_cuenta: account.tipo_cuenta,
          es_superadministrador: account.es_superadministrador,
          debe_cambiar_contrasena: account.debe_cambiar_contrasena
        }
      });
    }
  );

  // Cambio de clave temporal y voluntario. Invalida de inmediato TODOS los
  // JWT previos al incrementar sesion_version, sin depender de su vencimiento.
  app.post<{ Body: { contrasena_actual: string; nueva_contrasena: string } }>(
    '/api/auth/cambiar-contrasena',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { body: {
        type: 'object', additionalProperties: false,
        required: ['contrasena_actual','nueva_contrasena'],
        properties: {
          contrasena_actual: { type: 'string', minLength: 1, maxLength: 128 },
          nueva_contrasena: { type: 'string', minLength: 12, maxLength: 128 }
        }
      }}
    },
    async (request, reply) => {
      reply.header('Cache-Control','no-store');
      let sub: unknown;
      let sv: unknown;
      try {
        const claims = await request.jwtVerify() as { sub?: unknown; sv?: unknown };
        sub = claims.sub;
        sv = claims.sv;
      } catch { return reply.code(401).send({error:'Sesión inválida o vencida'}); }
      if (typeof sub !== 'string' || !/^[0-9]{1,18}$/.test(sub)) {
        return reply.code(401).send({error:'Sesión inválida'});
      }
      const { contrasena_actual, nueva_contrasena } = request.body;
      if (contrasena_actual === nueva_contrasena) {
        return reply.code(400).send({error:'La nueva contraseña debe ser diferente de la actual.'});
      }
      const {rows} = await pool.query<AccountRow>(
        `SELECT id_usuario::text,nombre_usuario,estado,contrasena_hash,
                nombre_mostrado,tipo_cuenta,es_superadministrador,
                debe_cambiar_contrasena,sesion_version
           FROM sigpmat.usuarios WHERE id_usuario=$1::bigint`,[sub]);
      const account=rows[0];
      if (!account || account.estado !== 'activa' || (sv ?? 0) !== account.sesion_version) {
        return reply.code(401).send({error:'Sesión revocada. Inicia sesión nuevamente.'});
      }
      const valida = await argon2.verify(account.contrasena_hash,contrasena_actual).catch(()=>false);
      if (!valida) return reply.code(401).send({error:'La contraseña actual es incorrecta.'});
      const hash = await argon2.hash(nueva_contrasena,{
        type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1
      });
      const result=await pool.query(
        `UPDATE sigpmat.usuarios SET contrasena_hash=$2,
          debe_cambiar_contrasena=FALSE,sesion_version=sesion_version+1
          WHERE id_usuario=$1::bigint AND contrasena_hash=$3
            AND sesion_version=$4 AND estado='activa'`,
        [sub,hash,account.contrasena_hash,account.sesion_version]);
      if (result.rowCount!==1) {
        return reply.code(409).send({error:'La cuenta cambió durante la operación. Inicia sesión otra vez.'});
      }
      return reply.send({status:'ok',mensaje:'Contraseña actualizada. Inicia sesión con tu nueva contraseña.'});
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
