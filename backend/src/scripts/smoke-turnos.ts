import { password } from '@inquirer/prompts';
import { config } from '../config.js';
import { pool } from '../db.js';

if (process.env.NODE_ENV !== 'development' || config.pgDatabase !== 'sigpmat_dev') {
  throw new Error('Este script solo puede ejecutarse en sigpmat_dev con NODE_ENV=development');
}

const API = 'http://127.0.0.1:' + config.appPort;
let aprobadas = 0;
function ok(texto: string) { aprobadas++; console.log('OK ' + String(aprobadas).padStart(2,'0') + ': ' + texto); }
function comprobar(condicion: unknown, texto: string): asserts condicion {
  if (!condicion) throw new Error(texto);
}
async function solicitar(
  metodo: 'GET' | 'POST' | 'PATCH',
  ruta: string, token: string | null, esperado: number, cuerpo?: object
): Promise<unknown> {
  const respuesta = await fetch(API + ruta, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {})
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {})
  });
  const datos = await respuesta.json().catch(() => null) as unknown;
  if (respuesta.status !== esperado) {
    throw new Error(metodo + ' ' + ruta + ': HTTP ' + respuesta.status +
      ', se esperaba ' + esperado + '. ' + JSON.stringify(datos));
  }
  return datos;
}
async function acceder(usuario: string, clave: string) {
  const r = await solicitar('POST','/api/auth/login',null,200,{
    nombre_usuario: usuario, contrasena: clave
  }) as { access_token?: string };
  comprobar(r.access_token,'La sesión no devolvió un token');
  ok('Inicio de sesión ' + usuario + ' — HTTP 200');
  return r.access_token;
}

async function main() {
  const adminClave = await password({message:'Clave admin.dev (oculta):',mask:'*'});
  const jefeClave = await password({message:'Clave jefe.dev (oculta):',mask:'*'});
  const admin = await acceder('admin.dev',adminClave);
  const jefe = await acceder('jefe.dev',jefeClave);

  await solicitar('GET','/api/cargos',null,401);
  ok('Catálogo protegido sin token — HTTP 401');
  const cargos = await solicitar('GET','/api/cargos',admin,200) as {
    cargos: Array<{id_cargo:string;nombre:string}>
  };
  comprobar(cargos.cargos.length>0,'Faltan cargos de ensayo');
  ok('Catálogo de cargos disponible — HTTP 200');

  await solicitar('GET','/api/turnos',admin,200);
  ok('Consulta de turnos — HTTP 200');

  const { rows: areas } = await pool.query<{
    id_departamento:string;codigo:string
  }>(
    "SELECT id_departamento::text,codigo FROM sigpmat.departamentos " +
    "WHERE codigo IN ('DEV-AREA-A','DEV-AREA-B') AND activo=TRUE ORDER BY codigo"
  );
  const areaA=areas.find(a=>a.codigo==='DEV-AREA-A');
  const areaB=areas.find(a=>a.codigo==='DEV-AREA-B');
  comprobar(areaA && areaB,'Faltan DEV-AREA-A y DEV-AREA-B');

  const inicio=new Date(Date.now()+72*60*60*1000);
  const fin=new Date(inicio.getTime()+4*60*60*1000);
  const {rows: equipo}=await pool.query<{
    id_empleado:string;id_cargo:string;nombre_cargo:string
  }>(
    "SELECT e.id_empleado::text,e.id_cargo::text,c.nombre AS nombre_cargo " +
    "FROM sigpmat.empleados e JOIN sigpmat.cargos c ON c.id_cargo=e.id_cargo " +
    "JOIN sigpmat.empleado_departamento ed ON ed.id_empleado=e.id_empleado " +
    "WHERE e.estado_vinculo='activo' AND c.activo=TRUE " +
    "AND ed.id_departamento=$1::bigint " +
    "AND ed.fecha_inicio<=($2::timestamptz AT TIME ZONE 'America/El_Salvador')::date " +
    "AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= ($3::timestamptz AT TIME ZONE 'America/El_Salvador')::date) " +
    "ORDER BY e.codigo_empleado LIMIT 1",
    [areaA.id_departamento,inicio.toISOString(),fin.toISOString()]
  );
  comprobar(equipo[0],'No hay empleado activo en el área A con adscripción vigente');

  const cuerpo={
    id_departamento:areaA.id_departamento,
    id_cargo:equipo[0].id_cargo,
    tipo_turno:'diurno',
    inicio_at:inicio.toISOString(),
    fin_at:fin.toISOString(),
    cupos_requeridos:1,
    prioridad:'normal'
  };

  await solicitar('POST','/api/turnos',jefe,403,{
    ...cuerpo,id_departamento:areaB.id_departamento
  });
  ok('Jefe de A no crea turnos en el área B — HTTP 403');

  await solicitar('POST','/api/turnos',admin,422,{
    ...cuerpo,fin_at:new Date(inicio.getTime()-60*60*1000).toISOString()
  });
  ok('Intervalo inválido rechazado — HTTP 422');

  const creado=await solicitar('POST','/api/turnos',admin,201,cuerpo) as {
    turno:{id_turno:string;id_requerimiento:string}
  };
  comprobar(creado.turno.id_turno && creado.turno.id_requerimiento,'No se recibieron IDs de creación');
  const id=creado.turno.id_turno,req=creado.turno.id_requerimiento;
  ok('Turno y cupo guardados en una transacción — HTTP 201');

  const detalle=await solicitar('GET','/api/turnos/'+id,admin,200) as {
    requerimientos:Array<{id_requerimiento:string}>
  };
  comprobar(detalle.requerimientos.some(r=>r.id_requerimiento===req),'Requerimiento no disponible');
  ok('Detalle del turno visible — HTTP 200');

  const asignacion=await solicitar('POST','/api/turnos/'+id+'/asignaciones',admin,201,{
    id_requerimiento:req,id_empleado:equipo[0].id_empleado
  }) as {asignacion:{id_asignacion:string}};
  comprobar(asignacion.asignacion.id_asignacion,'Sin identificador de asignación');
  ok('Empleado asignado — HTTP 201');

  await solicitar('POST','/api/turnos/'+id+'/asignaciones',admin,409,{
    id_requerimiento:req,id_empleado:equipo[0].id_empleado
  });
  ok('Asignación duplicada rechazada — HTTP 409');

  await solicitar('PATCH','/api/turnos/'+id+'/cancelar',admin,409);
  ok('No se cancela un turno ocupado — HTTP 409');

  await solicitar('PATCH','/api/asignaciones/'+asignacion.asignacion.id_asignacion+'/cancelar',admin,200);
  ok('Asignación cancelada — HTTP 200');

  await solicitar('PATCH','/api/turnos/'+id+'/cancelar',admin,200);
  ok('Turno cancelado después de liberar cupo — HTTP 200');

  const lista=await solicitar('GET','/api/turnos',admin,200) as {
    turnos:Array<{id_turno:string;estado:string}>
  };
  comprobar(lista.turnos.some(t=>t.id_turno===id && t.estado==='cancelado'),
    'El turno cancelado no está en el listado');
  ok('Cancelación persistida en PostgreSQL — HTTP 200');

  console.log('PRUEBAS DE TURNOS ' + aprobadas + '/14 COMPLETADAS');
  console.log('El turno ficticio y su asignación cancelada quedan registrados en sigpmat_dev.');
}

try { await main(); }
catch(e){console.error('ERROR:',e);process.exitCode=1;}
finally { await pool.end(); }
