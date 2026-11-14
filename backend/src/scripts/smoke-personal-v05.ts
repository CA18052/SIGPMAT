import { password } from '@inquirer/prompts';
import { config } from '../config.js';
import { pool } from '../db.js';

/**
 * Pruebas de SIGPMAT v0.5, en sigpmat_dev exclusivamente.
 * Se conserva un registro ficticio de acreditacion y traslado futuro.
 * Ninguna credencial ni token se imprime en Terminal.
 */
if (process.env.NODE_ENV !== 'development' || config.pgDatabase !== 'sigpmat_dev') {
  throw new Error('Pruebas exclusivas de NODE_ENV=development y sigpmat_dev');
}
const API = `http://127.0.0.1:${config.appPort}`;
const CODIGO_ESP = 'DEV-ESP-01';
function debe(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
async function login(nombre_usuario: string, contrasena: string) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_usuario, contrasena })
  });
  debe(r.status === 200, `Inicio ${nombre_usuario}: HTTP ${r.status} != 200`);
  const b = await r.json() as { access_token?: string };
  debe(b.access_token, `Falta token para ${nombre_usuario}`);
  console.log(`OK: inicio de sesion ${nombre_usuario} — HTTP 200`);
  return b.access_token;
}
async function call(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  token: string | null,
  expected: number,
  body?: object
) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (r.status !== expected) {
    const info = await r.json().catch(() => null) as { error?: string } | null;
    throw new Error(`${method} ${path}: HTTP ${r.status}, se esperaba ${expected}. ${info?.error ?? ''}`);
  }
  return r;
}

async function main() {
  const adminPass = await password({ message: 'Clave admin.dev (oculta):', mask: '*' });
  const jefePass = await password({ message: 'Clave jefe.dev (oculta):', mask: '*' });
  const admin = await login('admin.dev', adminPass);                                    // 01
  const jefe = await login('jefe.dev', jefePass);                                       // 02
  const { rows: empleados } = await pool.query<{ id_empleado: string; codigo_empleado: string }>(
    `SELECT id_empleado::text, codigo_empleado FROM sigpmat.empleados
      WHERE codigo_empleado IN ('DEV-EMP-003','DEV-EMP-002','DEV-JEFE-001')`
  );
  const emp = empleados.find(e => e.codigo_empleado === 'DEV-EMP-003');
  const empB = empleados.find(e => e.codigo_empleado === 'DEV-EMP-002');
  const empJ = empleados.find(e => e.codigo_empleado === 'DEV-JEFE-001');
  debe(emp && empB && empJ, 'Faltan empleados de ensayo v0.3/v0.4');
  const { rows: deps } = await pool.query<{ id_departamento: string; codigo: string }>(
    `SELECT id_departamento::text, codigo FROM sigpmat.departamentos
      WHERE codigo IN ('DEV-AREA-A','DEV-AREA-B')`
  );
  const a = deps.find(e => e.codigo === 'DEV-AREA-A');
  const b = deps.find(e => e.codigo === 'DEV-AREA-B');
  debe(a && b, 'Faltan departamentos de ensayo');

  await pool.query(
    `INSERT INTO sigpmat.especialidades (codigo, nombre, descripcion, activo)
     VALUES ($1,'Especialidad ficticia SIGPMAT','Solo pruebas locales',TRUE)
     ON CONFLICT (codigo) DO NOTHING`, [CODIGO_ESP]
  );
  const { rows: esp } = await pool.query<{ id_especialidad: string }>(
    `SELECT id_especialidad::text FROM sigpmat.especialidades
      WHERE codigo=$1 AND nombre='Especialidad ficticia SIGPMAT' AND activo=TRUE`, [CODIGO_ESP]
  );
  debe(esp[0], 'Catalogo de especialidad ficticia incompatible');

  await call('GET', '/api/especialidades', null, 401);                                  // 03
  console.log('OK: catalogo sin token denegado — HTTP 401');
  const catalogoA = await call('GET','/api/especialidades',admin,200);                  // 04
  const ca = await catalogoA.json() as { especialidades?: Array<{ codigo: string }> };
  debe(ca.especialidades?.some(x=>x.codigo===CODIGO_ESP), 'Administrador no consulta la especialidad DEV');
  console.log('OK: administrador consulta especialidades — HTTP 200');
  const catalogoJ = await call('GET','/api/especialidades',jefe,200);                   // 05
  const cj = await catalogoJ.json() as { especialidades?: Array<{ codigo: string }> };
  debe(cj.especialidades?.some(x=>x.codigo===CODIGO_ESP), 'Jefe no consulta catalogo');
  console.log('OK: jefe consulta catalogo — HTTP 200');

  await call('PATCH',`/api/empleados/${emp.id_empleado}`,jefe,403,{nombres:'No permitido'}); // 06
  console.log('OK: jefe no modifica empleado — HTTP 403');
  await call('PATCH',`/api/empleados/${emp.id_empleado}`,admin,400,{estado_vinculo:'desconocido'}); //07
  console.log('OK: estado invalido rechazado — HTTP 400');
  const patch = await call('PATCH',`/api/empleados/${emp.id_empleado}`,admin,200,
    {nombres:'Personal QA'});                                                         // 08
  const updated = await patch.json() as { empleado?: { nombres?: string } };
  debe(updated.empleado?.nombres==='Personal QA','Actualizacion no aplicada');
  console.log('OK: administrador actualiza nombres — HTTP 200');
  const check = await call('GET',`/api/empleados/${emp.id_empleado}`,jefe,200);        // 09
  const checkB = await check.json() as { empleado?: { nombres?: string } };
  debe(checkB.empleado?.nombres==='Personal QA', 'Cambio no persistio');
  console.log('OK: jefe ve nombre actualizado — HTTP 200');

  const acreditar = {
    id_especialidad: esp[0].id_especialidad,
    fecha_acreditacion: '2026-10-01',
    vigente_desde: '2026-10-01',
    es_principal: true
  };
  await call('POST',`/api/empleados/${emp.id_empleado}/especialidades`,null,401,acreditar); // 10
  console.log('OK: acreditacion sin token rechazada — HTTP 401');
  await call('POST',`/api/empleados/${emp.id_empleado}/especialidades`,admin,422,
    {...acreditar,id_especialidad:'9223372036854775807'});                            // 11
  console.log('OK: especialidad inexistente rechazada — HTTP 422');
  const { rows: antes } = await pool.query(
    `SELECT 1 FROM sigpmat.empleado_especialidad WHERE id_empleado=$1::bigint
        AND id_especialidad=$2::bigint AND vigente_desde='2026-10-01'::date`,
    [emp.id_empleado, esp[0].id_especialidad]
  );
  if (!antes.length) {
    await call('POST',`/api/empleados/${emp.id_empleado}/especialidades`,admin,201,acreditar); //12
    console.log('OK: alta de acreditacion ficticia — HTTP 201');
  } else {
    await call('GET',`/api/empleados/${emp.id_empleado}/especialidades`,admin,200);  //12
    console.log('OK: acreditacion creada anteriormente, verificada — HTTP 200');
  }
  await call('POST',`/api/empleados/${emp.id_empleado}/especialidades`,admin,409,acreditar); // 13
  console.log('OK: acreditacion superpuesta rechazada — HTTP 409');
  const checkEsp = await call('GET',`/api/empleados/${emp.id_empleado}/especialidades`,jefe,200); //14
  const espBody = await checkEsp.json() as { especialidades?: Array<{ codigo: string }> };
  debe(espBody.especialidades?.some(x=>x.codigo===CODIGO_ESP),'El jefe no ve acreditacion del area A');
  console.log('OK: jefe consulta acreditacion en su area — HTTP 200');
  await call('GET',`/api/empleados/${empB.id_empleado}/especialidades`,jefe,404);   //15
  console.log('OK: jefe no conoce acreditaciones del area B — HTTP 404');

  const { rows: fechas } = await pool.query<{ fecha: string }>(
    `SELECT to_char(CURRENT_DATE+3,'YYYY-MM-DD') AS fecha`
  );
  const fecha_efectiva = fechas[0]?.fecha;
  debe(fecha_efectiva,'No se pudo obtener fecha SQL');
  const traslado = { id_departamento: b.id_departamento, fecha_efectiva };
  await call('POST',`/api/empleados/${emp.id_empleado}/traslados`,jefe,403,traslado); //16
  console.log('OK: jefe no programa traslados — HTTP 403');
  await call('POST',`/api/empleados/${empJ.id_empleado}/traslados`,admin,409,traslado); //17
  console.log('OK: empleado con cuenta asociada protegido — HTTP 409');
  await call('POST',`/api/empleados/${emp.id_empleado}/traslados`,admin,422,
    {id_departamento:b.id_departamento,fecha_efectiva:'2020-01-01'});                 //18
  console.log('OK: traslado con fecha pasada rechazado — HTTP 422');
  await call('POST',`/api/empleados/${emp.id_empleado}/traslados`,admin,422,
    {id_departamento:'9223372036854775807',fecha_efectiva});                          //19
  console.log('OK: departamento inexistente rechazado — HTTP 422');

  const { rows: futuro } = await pool.query<{ id_vinculo: string; fecha_inicio: string }>(
    `SELECT id_vinculo::text, to_char(fecha_inicio,'YYYY-MM-DD') AS fecha_inicio
       FROM sigpmat.empleado_departamento
      WHERE id_empleado=$1::bigint AND id_departamento=$2::bigint
        AND fecha_inicio > CURRENT_DATE
      ORDER BY fecha_inicio LIMIT 1`, [emp.id_empleado,b.id_departamento]
  );
  if (!futuro.length) {
    await call('POST',`/api/empleados/${emp.id_empleado}/traslados`,admin,201,traslado); //20
    console.log('OK: traslado futuro programado — HTTP 201');
  } else {
    console.log(`OK: traslado programado anteriormente, confirmado (${futuro[0].fecha_inicio})`); //20
  }
  await call('POST',`/api/empleados/${emp.id_empleado}/traslados`,admin,409,traslado); //21
  console.log('OK: segundo traslado incompatible rechazado — HTTP 409');
  const { rows: historial } = await pool.query<{ codigo: string; inicio: string; fin: string | null }>(
    `SELECT d.codigo, to_char(ed.fecha_inicio, 'YYYY-MM-DD') AS inicio,
            to_char(ed.fecha_fin, 'YYYY-MM-DD') AS fin
       FROM sigpmat.empleado_departamento ed
       JOIN sigpmat.departamentos d ON d.id_departamento=ed.id_departamento
      WHERE ed.id_empleado=$1::bigint ORDER BY ed.fecha_inicio`, [emp.id_empleado]
  );
  debe(historial.some(h=>h.codigo==='DEV-AREA-A' && h.fin !== null) &&
       historial.some(h=>h.codigo==='DEV-AREA-B'), 'El historial de traslado no se preservo'); //22
  console.log('OK: historial A -> B preservado en PostgreSQL');
  const actual = await call('GET',`/api/empleados/${emp.id_empleado}`,jefe,200);     //23
  const jsonActual = await actual.json() as { empleado?: { codigo_empleado?: string } };
  debe(jsonActual.empleado?.codigo_empleado==='DEV-EMP-003','Acceso vigente incorrecto');
  console.log('OK: jefatura actual sigue autorizada hasta la fecha efectiva — HTTP 200');
  const { rows: estructura } = await pool.query<{ n: number }>(
    `SELECT count(*)::integer AS n FROM information_schema.tables
      WHERE table_schema='sigpmat' AND table_type='BASE TABLE'`
  );
  debe(estructura[0]?.n===24,'Se altero el numero de tablas');                       //24
  console.log('OK: estructura de 24 tablas preservada');
  console.log('PRUEBAS DEL MODULO PERSONAL V0.5 24/24 COMPLETADAS');
}
try { await main(); }
catch (error) { console.error('ERROR:', error instanceof Error ? error.message : error); process.exitCode=1; }
finally { await pool.end(); }
