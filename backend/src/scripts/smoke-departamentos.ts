import { password } from '@inquirer/prompts';
import { config } from '../config.js';
import { pool } from '../db.js';

if (process.env.NODE_ENV !== 'development' || config.pgDatabase !== 'sigpmat_dev') {
  throw new Error('Pruebas de departamentos permitidas solo en sigpmat_dev');
}

const API = `http://127.0.0.1:${config.appPort}`;
type LoginResponse = {
  access_token?: string;
  usuario?: { roles?: string[] };
};

type DeptResponse = {
  departamentos?: Array<{ codigo: string; id_departamento: string }>;
};
type EmpsResponse = {
  empleados?: Array<{ codigo_empleado: string }>;
};

async function login(nombre: string, clave: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_usuario: nombre, contrasena: clave })
  });
  if (r.status !== 200) {
    throw new Error(`Inicio de sesion ${nombre}: HTTP ${r.status}; esperado 200`);
  }
  const body = await r.json() as LoginResponse;
  if (!body.access_token) {
    throw new Error(`No se recibio token para ${nombre}`);
  }
  console.log(`OK: inicio de sesion ${nombre} — HTTP 200`);
  return body.access_token;
}

async function llamar(ruta: string, token: string | null, esperado: number) {
  const r = await fetch(`${API}${ruta}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (r.status !== esperado) {
    throw new Error(`${ruta}: HTTP ${r.status}; esperado ${esperado}`);
  }
  return r;
}

async function main() {
  const adminClave = await password({ message: 'Clave admin.dev (oculta):', mask: '*' });
  const jefeClave = await password({ message: 'Clave jefe.dev (oculta):', mask: '*' });
  const admin = await login('admin.dev', adminClave);
  const jefe = await login('jefe.dev', jefeClave);

  const resultado = await pool.query<{ id_departamento: string; codigo: string }>(
    `SELECT id_departamento::text, codigo FROM sigpmat.departamentos
      WHERE codigo IN ('DEV-AREA-A', 'DEV-AREA-B')`
  );
  const a = resultado.rows.find(d => d.codigo === 'DEV-AREA-A');
  const b = resultado.rows.find(d => d.codigo === 'DEV-AREA-B');
  if (!a || !b) throw new Error('Faltan los departamentos ficticios; ejecutar SQL 09');

  await llamar('/api/departamentos', null, 401);
  console.log('OK: listado sin token rechazado — HTTP 401');

  const adminList = await llamar('/api/departamentos', admin, 200);
  const listaAdmin = await adminList.json() as DeptResponse;
  if (!listaAdmin.departamentos?.some(d => d.codigo === a.codigo) ||
      !listaAdmin.departamentos?.some(d => d.codigo === b.codigo)) {
    throw new Error('El administrador no ve ambas areas ficticias');
  }
  console.log('OK: ADMIN_GENERAL ve ambos departamentos — HTTP 200');

  const jefeList = await llamar('/api/departamentos', jefe, 200);
  const listaJefe = await jefeList.json() as DeptResponse;
  if (!listaJefe.departamentos?.some(d => d.codigo === a.codigo) ||
      listaJefe.departamentos?.some(d => d.codigo === b.codigo)) {
    throw new Error('JEFE_AREA tiene un alcance incorrecto');
  }
  console.log('OK: JEFE_AREA solo lista su departamento A — HTTP 200');

  const vistaA = await llamar(`/api/departamentos/${a.id_departamento}/empleados`, jefe, 200);
  const empleadosA = await vistaA.json() as EmpsResponse;
  if (!empleadosA.empleados?.some(e => e.codigo_empleado === 'DEV-JEFE-001')) {
    throw new Error('No se ve al jefe ficticio en el Departamento A');
  }
  console.log('OK: JEFE_AREA consulta personal del area A — HTTP 200');

  await llamar(`/api/departamentos/${b.id_departamento}/empleados`, jefe, 403);
  console.log('OK: JEFE_AREA no accede al area B — HTTP 403');

  const vistaB = await llamar(`/api/departamentos/${b.id_departamento}/empleados`, admin, 200);
  const empleadosB = await vistaB.json() as EmpsResponse;
  if (!empleadosB.empleados?.some(e => e.codigo_empleado === 'DEV-EMP-002')) {
    throw new Error('El administrador no ve al empleado ficticio del area B');
  }
  console.log('OK: ADMIN_GENERAL consulta personal del area B — HTTP 200');
  console.log('PRUEBAS DE ALCANCE POR DEPARTAMENTO 8/8 COMPLETADAS');
}

try {
  await main();
} catch (err) {
  console.error('ERROR:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
