import argon2 from 'argon2';
import { password } from '@inquirer/prompts';
import { pool } from '../db.js';

const API = 'http://127.0.0.1:3001';
const USUARIO = 'jefe.dev';
const CORREO = 'jefe.dev@example.invalid';

async function main() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Prueba habilitada solo en desarrollo');
  }

  const clave = await password({
    message: 'Clave de ensayo para jefe.dev (oculta):',
    mask: '*'
  });

  if (clave.length < 12 || clave.length > 128) {
    throw new Error('La clave debe tener entre 12 y 128 caracteres');
  }

  const existente = await pool.query(
    `SELECT id_usuario
       FROM sigpmat.usuarios
      WHERE nombre_usuario = $1`,
    [USUARIO]
  );

  if (existente.rowCount === 0) {
    const hash = await argon2.hash(clave, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const rol = await client.query<{ id_rol: string }>(
        `SELECT id_rol::text
           FROM sigpmat.roles
          WHERE codigo = 'JEFE_AREA'
            AND activo = TRUE`
      );

      if (!rol.rows[0]) {
        throw new Error('No existe el rol JEFE_AREA activo');
      }

      const nuevo = await client.query<{ id_usuario: string }>(
        `INSERT INTO sigpmat.usuarios
           (nombre_usuario, correo_institucional,
            contrasena_hash, estado)
         VALUES ($1, $2, $3, 'activa')
         RETURNING id_usuario::text`,
        [USUARIO, CORREO, hash]
      );

      await client.query(
        `INSERT INTO sigpmat.usuario_roles
           (id_usuario, id_rol)
         VALUES ($1::bigint, $2::bigint)`,
        [nuevo.rows[0].id_usuario, rol.rows[0].id_rol]
      );

      await client.query('COMMIT');
      console.log('Cuenta ficticia JEFE_AREA creada.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    console.log('jefe.dev ya existe; se probara su acceso.');
  }

  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre_usuario: USUARIO,
      contrasena: clave
    })
  });

  if (login.status !== 200) {
    throw new Error(`Login: HTTP ${login.status}; esperado 200`);
  }

  const sesion = await login.json() as {
    access_token?: string;
    usuario?: { roles?: string[] };
  };

  const roles = sesion.usuario?.roles ?? [];

  if (
    !sesion.access_token ||
    !roles.includes('JEFE_AREA') ||
    roles.includes('ADMIN_GENERAL')
  ) {
    throw new Error('Los roles o el token no son los esperados');
  }

  console.log('OK: inicio de sesion JEFE_AREA — HTTP 200');
  console.log('OK: rol JEFE_AREA sin ADMIN_GENERAL');

  const headers = {
    Authorization: `Bearer ${sesion.access_token}`
  };

  const identidad = await fetch(`${API}/api/auth/me`, {
    headers
  });

  if (identidad.status !== 200) {
    throw new Error(
      `Identidad: HTTP ${identidad.status}; esperado 200`
    );
  }

  console.log('OK: identidad JEFE_AREA — HTTP 200');

  const administrador = await fetch(`${API}/api/admin/ping`, {
    headers
  });

  if (administrador.status !== 403) {
    throw new Error(
      `Permiso administrador: HTTP ${administrador.status}; esperado 403`
    );
  }

  console.log('OK: acceso administrativo denegado — HTTP 403');
  console.log('PRUEBAS RBAC COMPLETADAS');
}

try {
  await main();
} catch (error) {
  console.error('ERROR:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
