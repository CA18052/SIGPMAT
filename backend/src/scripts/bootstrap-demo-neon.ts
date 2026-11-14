import argon2 from 'argon2';
import { password } from '@inquirer/prompts';
import { pool } from '../db.js';

const url = process.env.DATABASE_URL;
if (!url || process.env.CREAR_CUENTAS_DEMO !== 'SI') {
  throw new Error('Se necesita DATABASE_URL y CREAR_CUENTAS_DEMO=SI');
}
const conexion = new URL(url);
if (!conexion.hostname.endsWith('.neon.tech') ||
    decodeURIComponent(conexion.username) !== 'sigpmat_app' ||
    conexion.pathname !== '/neondb') {
  throw new Error('Este script solo se permite con el usuario sigpmat_app de Neon, base neondb');
}

const opciones = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

async function main() {
  const existentes = await pool.query(
    "SELECT nombre_usuario FROM sigpmat.usuarios WHERE nombre_usuario IN ('admin.demo','jefe.demo')"
  );
  if (existentes.rowCount) {
    throw new Error('Ya existe alguna cuenta demo. No se modificaron contraseñas.');
  }

  const claveAdmin = await password({
    message: 'Contraseña para admin.demo (oculta):', mask: '*'
  });
  if (claveAdmin.length < 12 || claveAdmin.length > 128) {
    throw new Error('La contraseña debe tener de 12 a 128 caracteres');
  }
  const claveJefe = await password({
    message: 'Contraseña para jefe.demo (oculta):', mask: '*'
  });
  if (claveJefe.length < 12 || claveJefe.length > 128) {
    throw new Error('La contraseña debe tener de 12 a 128 caracteres');
  }
  if (claveAdmin === claveJefe) throw new Error('Cada cuenta debe tener una contraseña diferente');

  const hashAdmin = await argon2.hash(claveAdmin, opciones);
  const hashJefe = await argon2.hash(claveJefe, opciones);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roles = await client.query<{id_rol:string;codigo:string}>(
      "SELECT id_rol::text,codigo FROM sigpmat.roles WHERE activo=TRUE AND codigo IN ('ADMIN_GENERAL','JEFE_AREA')"
    );
    const rolAdmin = roles.rows.find(r => r.codigo === 'ADMIN_GENERAL');
    const rolJefe = roles.rows.find(r => r.codigo === 'JEFE_AREA');
    if (!rolAdmin || !rolJefe) throw new Error('No están creados los roles básicos');

    const vinculo = await client.query<{id_empleado:string;id_vinculo:string}>(
      "SELECT e.id_empleado::text,ed.id_vinculo::text " +
      "FROM sigpmat.empleados e JOIN sigpmat.empleado_departamento ed ON ed.id_empleado=e.id_empleado " +
      "JOIN sigpmat.departamentos d ON d.id_departamento=ed.id_departamento " +
      "WHERE e.codigo_empleado='DEMO-MI-01' AND d.codigo='DEMO-MI' " +
      "AND e.estado_vinculo='activo' AND ed.fecha_inicio<=CURRENT_DATE " +
      "AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=CURRENT_DATE) " +
      "FOR UPDATE OF e,ed"
    );
    if (vinculo.rows.length !== 1) {
      throw new Error('Falta el empleado DEMO-MI-01 o tiene varias adscripciones vigentes');
    }

    const admin = await client.query<{id_usuario:string}>(
      "INSERT INTO sigpmat.usuarios " +
      "(nombre_usuario,correo_institucional,contrasena_hash,estado) " +
      "VALUES ('admin.demo','admin.demo@example.invalid',$1,'activa') RETURNING id_usuario::text",
      [hashAdmin]
    );
    const jefe = await client.query<{id_usuario:string}>(
      "INSERT INTO sigpmat.usuarios " +
      "(id_empleado,nombre_usuario,correo_institucional,contrasena_hash,estado) " +
      "VALUES ($1::bigint,'jefe.demo','jefe.demo@example.invalid',$2,'activa') RETURNING id_usuario::text",
      [vinculo.rows[0].id_empleado, hashJefe]
    );

    await client.query(
      "INSERT INTO sigpmat.usuario_roles(id_usuario,id_rol) VALUES " +
      "($1::bigint,$2::bigint),($3::bigint,$4::bigint)",
      [admin.rows[0].id_usuario,rolAdmin.id_rol,jefe.rows[0].id_usuario,rolJefe.id_rol]
    );
    await client.query(
      "UPDATE sigpmat.empleado_departamento SET es_jefe=TRUE WHERE id_vinculo=$1::bigint",
      [vinculo.rows[0].id_vinculo]
    );

    await client.query('COMMIT');
    console.log('Cuentas admin.demo y jefe.demo creadas.');
    console.log('jefe.demo tiene acceso al área de Medicina Interna.');
    console.log('Las contraseñas no se guardaron en texto plano.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

try { await main(); }
catch (e) { console.error('No se prepararon las cuentas:',e); process.exitCode=1; }
finally { await pool.end(); }
