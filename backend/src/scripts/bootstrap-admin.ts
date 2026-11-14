import argon2 from 'argon2';
import { input, password } from '@inquirer/prompts';
import { pool } from '../db.js';

if (process.env.NODE_ENV !== 'development') {
  throw new Error('Creacion de usuario de ensayo habilitada solo en desarrollo');
}

const nombre = await input({ message: 'Usuario de desarrollo:', default: 'admin.dev' });
const correo = await input({ message: 'Correo ficticio (.invalid):', default: 'admin.dev@example.invalid' });
if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(nombre)) {
  throw new Error('El identificador debe tener 3-50 caracteres alfanumericos, punto, guion o guion bajo');
}
if (!/^[a-zA-Z0-9_.-]+@example\.invalid$/.test(correo) || correo.length > 150) {
  throw new Error('Use exclusivamente una direccion ficticia de example.invalid');
}
const clave = await password({ message: 'Clave de ensayo (no se muestra):', mask: '*' });
if (clave.length < 12 || clave.length > 128) {
  throw new Error('La clave debe tener entre 12 y 128 caracteres');
}
const hash = await argon2.hash(clave, {
  type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1
});

const client = await pool.connect();
try {
  await client.query('BEGIN');
  const roleResult = await client.query<{ id_rol: string }>(
    `SELECT id_rol::text FROM sigpmat.roles
      WHERE codigo = 'ADMIN_GENERAL' AND activo = TRUE`
  );
  const rolId = roleResult.rows[0]?.id_rol;
  if (!rolId) throw new Error('Falta el rol ADMIN_GENERAL activo');

  const userResult = await client.query<{ id_usuario: string }>(
    `INSERT INTO sigpmat.usuarios
        (nombre_usuario, correo_institucional, contrasena_hash, estado)
     VALUES ($1, $2, $3, 'activa') RETURNING id_usuario::text`,
    [nombre, correo, hash]
  );
  const id = userResult.rows[0]?.id_usuario;
  if (!id) throw new Error('No se genero el identificador de usuario');

  await client.query(
    `INSERT INTO sigpmat.usuario_roles (id_usuario, id_rol)
     VALUES ($1::bigint, $2::bigint)`,
    [id, rolId]
  );
  await client.query('COMMIT');
  console.log(`Usuario de ensayo ${nombre} creado y vinculado a ADMIN_GENERAL.`);
  console.log('No se ha mostrado ni guardado la contraseña en texto plano.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('No se creo el usuario de ensayo. Se revirtieron los cambios.');
  throw error;
} finally {
  client.release();
  await pool.end();
}
