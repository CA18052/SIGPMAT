import { password } from '@inquirer/prompts';
import { config } from '../config.js';
import { pool } from '../db.js';

/**
 * 15 comprobaciones del modulo personal v0.4.
 * Crea un solo empleado ficticio DEV-EMP-003 en la primera ejecucion.
 * Las siguientes ejecuciones reconocen ese registro; no crean duplicados.
 * Nunca imprime contraseñas ni JWT.
 */
if (process.env.NODE_ENV !== 'development' || config.pgDatabase !== 'sigpmat_dev') {
  throw new Error('Este ensayo solo se permite en NODE_ENV=development y sigpmat_dev');
}

const API = `http://127.0.0.1:${config.appPort}`;
type Login = { access_token?: string };
type Listado = { empleados?: Array<{ codigo_empleado: string; id_empleado: string }> };
type Detalle = { empleado?: { codigo_empleado: string; departamentos?: Array<{ codigo: string }> } };

async function iniciarSesion(usuario: string, clave: string): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_usuario: usuario, contrasena: clave })
  });
  if (res.status !== 200) {
    throw new Error(`Login ${usuario}: HTTP ${res.status}; se esperaba 200`);
  }
  const json = await res.json() as Login;
  if (!json.access_token) throw new Error(`Login ${usuario} sin token`);
  console.log(`OK: acceso de ${usuario} — HTTP 200`);
  return json.access_token;
}

async function pedir(
  metodo: 'GET' | 'POST', ruta: string, token: string | null,
  esperado: number, datos?: object
): Promise<Response> {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(datos ? { 'Content-Type': 'application/json' } : {})
    },
    ...(datos ? { body: JSON.stringify(datos) } : {})
  });
  if (res.status !== esperado) {
    const json = await res.json().catch(() => null);
    const razon = json && typeof json === 'object' && 'error' in json
      ? String(json.error) : 'sin descripcion';
    throw new Error(`${metodo} ${ruta}: HTTP ${res.status}, esperado ${esperado}. ${razon}`);
  }
  return res;
}

function debe(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(mensaje);
}

async function main() {
  const claveAdmin = await password({ message: 'Clave admin.dev (oculta):', mask: '*' });
  const claveJefe = await password({ message: 'Clave jefe.dev (oculta):', mask: '*' });
  const admin = await iniciarSesion('admin.dev', claveAdmin);               // 1
  const jefe = await iniciarSesion('jefe.dev', claveJefe);                  // 2

  const { rows: deps } = await pool.query<{ id_departamento: string; codigo: string }>(
    `SELECT id_departamento::text, codigo FROM sigpmat.departamentos
      WHERE codigo IN ('DEV-AREA-A', 'DEV-AREA-B') AND activo`
  );
  const a = deps.find(x => x.codigo === 'DEV-AREA-A');
  const b = deps.find(x => x.codigo === 'DEV-AREA-B');
  debe(a && b, 'Faltan los departamentos DEV, ejecutar los archivos SQL 09 y 10');

  const { rows: cargos } = await pool.query<{ id_cargo: string }>(
    `SELECT id_cargo::text FROM sigpmat.cargos
      WHERE nombre = 'Cargo médico de ensayo SIGPMAT' AND activo`
  );
  const cargo = cargos[0];
  debe(cargo, 'No se encontro el cargo ficticio');

  const { rows: empleadosBase } = await pool.query<{ id_empleado: string; codigo_empleado: string }>(
    `SELECT id_empleado::text, codigo_empleado FROM sigpmat.empleados
      WHERE codigo_empleado IN ('DEV-JEFE-001', 'DEV-EMP-002')`
  );
  const empleadoA = empleadosBase.find(x => x.codigo_empleado === 'DEV-JEFE-001');
  const empleadoB = empleadosBase.find(x => x.codigo_empleado === 'DEV-EMP-002');
  debe(empleadoA && empleadoB, 'Faltan los empleados de ensayo de v0.3');

  await pedir('GET', '/api/empleados', null, 401);                         // 3
  console.log('OK: listado de empleados sin token — HTTP 401');

  const resAdmin = await pedir('GET', '/api/empleados', admin, 200);       // 4
  const adminList = await resAdmin.json() as Listado;
  debe(adminList.empleados?.some(x => x.codigo_empleado === empleadoA.codigo_empleado) &&
       adminList.empleados?.some(x => x.codigo_empleado === empleadoB.codigo_empleado),
       'Administrador no ve ambos empleados de ensayo');
  console.log('OK: administrador ve empleados A y B — HTTP 200');

  const resJefe = await pedir('GET', '/api/empleados', jefe, 200);         // 5
  const jefeList = await resJefe.json() as Listado;
  debe(jefeList.empleados?.some(x => x.codigo_empleado === empleadoA.codigo_empleado) &&
       !jefeList.empleados?.some(x => x.codigo_empleado === empleadoB.codigo_empleado),
       'La lista del jefe tiene empleados de un area no autorizada');
  console.log('OK: jefe solo ve el personal de su area — HTTP 200');

  const resArea = await pedir('GET', `/api/empleados?departamento_id=${a.id_departamento}`, jefe, 200); // 6
  const areaList = await resArea.json() as Listado;
  debe(areaList.empleados?.some(x => x.codigo_empleado === empleadoA.codigo_empleado),
       'El filtro autorizado no devuelve al jefe de ensayo');
  console.log('OK: jefe filtra empleados del area A — HTTP 200');

  await pedir('GET', `/api/empleados?departamento_id=${b.id_departamento}`, jefe, 403); // 7
  console.log('OK: filtro del area B rechazado para el jefe — HTTP 403');

  const resDetalleA = await pedir('GET', `/api/empleados/${empleadoA.id_empleado}`, jefe, 200); // 8
  const detalleA = await resDetalleA.json() as Detalle;
  debe(detalleA.empleado?.codigo_empleado === 'DEV-JEFE-001', 'Detalle de jefe incompatible');
  console.log('OK: jefe consulta detalle permitido — HTTP 200');

  await pedir('GET', `/api/empleados/${empleadoB.id_empleado}`, jefe, 404); // 9
  console.log('OK: detalle fuera de alcance oculto — HTTP 404');

  const nuevaFicha = {
    codigo_empleado: 'DEV-EMP-003',
    nombres: 'Personal',
    apellidos: 'De Ensayo Tres',
    id_cargo: cargo.id_cargo,
    id_departamento: a.id_departamento
  };

  await pedir('POST', '/api/empleados', jefe, 403, nuevaFicha);           // 10
  console.log('OK: jefe no puede registrar empleados — HTTP 403');

  await pedir('POST', '/api/empleados', null, 401, nuevaFicha);          // 11
  console.log('OK: alta sin token rechazada — HTTP 401');

  await pedir('POST', '/api/empleados', admin, 422, {
    ...nuevaFicha, id_cargo: '9223372036854775807'
  });                                                                    // 12
  console.log('OK: cargo inexistente rechazado — HTTP 422');

  const previo = await pool.query<{ id_empleado: string }>(
    `SELECT id_empleado::text FROM sigpmat.empleados
      WHERE codigo_empleado = $1`, [nuevaFicha.codigo_empleado]
  );
  if (previo.rows.length === 0) {
    await pedir('POST', '/api/empleados', admin, 201, nuevaFicha);        // 13
    console.log('OK: alta transaccional del empleado de ensayo — HTTP 201');
  } else {
    const yaExiste = await pedir('GET', `/api/empleados/${previo.rows[0].id_empleado}`, admin, 200); // 13
    const detalle = await yaExiste.json() as Detalle;
    debe(detalle.empleado?.codigo_empleado === nuevaFicha.codigo_empleado &&
         detalle.empleado?.departamentos?.some(x => x.codigo === a.codigo),
         'DEV-EMP-003 existe, pero no pertenece al escenario de ensayo');
    console.log('OK: alta ficticia ya realizada; registro vigente verificado — HTTP 200');
  }

  await pedir('POST', '/api/empleados', admin, 409, nuevaFicha);          // 14
  console.log('OK: duplicado rechazado — HTTP 409');

  const { rows: creado } = await pool.query<{ id_empleado: string }>(
    `SELECT id_empleado::text FROM sigpmat.empleados
      WHERE codigo_empleado = $1`, [nuevaFicha.codigo_empleado]
  );
  debe(creado[0], 'No se encontro el empleado creado');
  const resp = await pedir('GET', `/api/empleados/${creado[0].id_empleado}`, jefe, 200); // 15
  const ver = await resp.json() as Detalle;
  debe(ver.empleado?.codigo_empleado === nuevaFicha.codigo_empleado,
       'El nuevo empleado no es visible al jefe de su departamento');
  console.log('OK: jefe consulta el nuevo empleado de su area — HTTP 200');
  console.log('PRUEBAS DE PERSONAL 15/15 COMPLETADAS');
}

try {
  await main();
} catch (e) {
  console.error('ERROR:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
