import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import { autorizar } from '../auth/routes.js';

/**
 * CRUD administrativo de SIGPMAT.
 * Borrado físico SOLO de registros que no tengan historial dependiente.
 * Las operaciones usan transacciones; jamás se utiliza CASCADE para saltarse las FK.
 */
const id = { type: 'string', pattern: '^[1-9][0-9]{0,18}$', maxLength: 19 };
const params = { type: 'object', required: ['id'], additionalProperties: false,
  properties: { id } };
const valido = (s: string) => /^[1-9][0-9]{0,18}$/.test(s) && BigInt(s) <= 9223372036854775807n;

type Params = { id: string };
type DepartamentoNuevo = { codigo: string; nombre: string; ubicacion?: string; extension?: string };
type DepartamentoCambio = {
  codigo?: string; nombre?: string; ubicacion?: string | null;
  extension?: string | null; activo?: boolean
};
type TurnoCambio = {
  id_departamento: string; tipo_turno: 'diurno' | 'nocturno' | 'mixto' | 'emergencia';
  inicio_at: string; fin_at: string; id_cargo: string; id_especialidad: string | null;
  cupos_requeridos: number; prioridad: 'normal' | 'alta' | 'critica';
};
const dt = { type:'string', minLength:20, maxLength:35 };
const departamentoProps = {
  codigo: { type:'string', minLength:3, maxLength:20, pattern:'^[A-Za-z0-9-]+$' },
  nombre: { type:'string', minLength:2, maxLength:80 },
  ubicacion: { anyOf:[{type:'string',maxLength:120},{type:'null'}] },
  extension: { anyOf:[{type:'string',maxLength:20},{type:'null'}] }
};
type ErrorCrud = { error: string; motivo: string; solucion: string; codigo: string };
const explicar = (
  reply: FastifyReply, estado: number, error: string,
  motivo: string, solucion: string, codigo: string
) => reply.code(estado).send({ error, motivo, solucion, codigo } satisfies ErrorCrud);

const status = (e: unknown, request: FastifyRequest, reply: FastifyReply) => {
  const err = e as {code?:string;message?:string} | null;
  // Mantener los errores técnicos completos SOLO en el log del servidor.
  if (err?.code==='23505') return explicar(reply,409,'No se pudo guardar el registro.',
    'Ya existe otro registro con ese código o nombre.',
    'Utiliza un código diferente o modifica el registro existente.','REGISTRO_DUPLICADO');
  if (err?.code==='23503') return explicar(reply,409,'No se puede completar la operación.',
    'El registro tiene datos relacionados que PostgreSQL debe conservar.',
    'Revisa las dependencias y, si conserva historial, utiliza la baja o cancelación en lugar del borrado físico.','REGISTRO_CON_DEPENDENCIAS');
  if (err?.code==='23514') return explicar(reply,409,'Operación rechazada.',
    err.message?.startsWith('SIGPMAT:') ? err.message.slice(9) : 'El cambio contradice una regla del sistema.',
    'Corrige los datos o consulta las restricciones de cobertura y asignación.','REGLA_INTEGRIDAD');
  if (err?.code==='42501') {
    request.log.error({err:e},'Privilegio PostgreSQL insuficiente en CRUD');
    return explicar(reply,500,'No se puede completar la operación.',
      'La conexión de la aplicación no tiene permisos suficientes en la base de datos.',
      'Contacta al administrador técnico para revisar los privilegios de la cuenta de PostgreSQL; tus datos no se modificaron.','PERMISOS_BASE_DATOS');
  }
  request.log.error({err:e},'CRUD administrativo');
  return explicar(reply,500,'No se pudo completar la operación.',
    'Ocurrió un error inesperado en el servidor. No es posible determinar la causa únicamente desde esta pantalla.',
    'Intenta nuevamente. Si persiste, comunica al equipo técnico el código de incidencia ' + request.id + '.','INCIDENCIA_' + request.id);
};
async function revertir(client: PoolClient) {
  try { await client.query('ROLLBACK'); } catch { /* conexión interrumpida */ }
}
const fecha = (valor: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(valor)) return null;
  const d = new Date(valor);
  return Number.isFinite(d.getTime()) ? d : null;
};

export function registrarCrudGestion(app: FastifyInstance) {
  app.post<{Body:DepartamentoNuevo}>('/api/departamentos',{
    schema:{body:{type:'object',additionalProperties:false,required:['codigo','nombre'],
      properties: departamentoProps}}
  },async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    if(!await autorizar(request,reply,'ADMIN_GENERAL'))return reply;
    const b=request.body;
    const nombre=b.nombre.trim(), codigo=b.codigo.trim().toUpperCase();
    if(!nombre || !codigo) return reply.code(400).send({error:'Código y nombre requeridos'});
    try{
      const r=await pool.query<{id_departamento:string}>(
        `INSERT INTO sigpmat.departamentos(codigo,nombre,ubicacion,extension,activo)
         VALUES ($1,$2,$3,$4,TRUE) RETURNING id_departamento::text`,
        [codigo,nombre,b.ubicacion?.trim()||null,b.extension?.trim()||null]
      );
      return reply.code(201).send({departamento:r.rows[0]});
    }catch(e){return status(e,request,reply);}
  });

  app.patch<{Params:Params;Body:DepartamentoCambio}>('/api/departamentos/:id',{
    schema:{params,body:{type:'object',additionalProperties:false,minProperties:1,
      properties:{...departamentoProps,activo:{type:'boolean'}}}}
  },async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    if(!await autorizar(request,reply,'ADMIN_GENERAL'))return reply;
    if(!valido(request.params.id))return reply.code(400).send({error:'ID inválido'});
    const b=request.body;
    if(b.nombre!==undefined && !b.nombre.trim())return reply.code(400).send({error:'El nombre no puede quedar vacío'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const actual=await client.query<{activo:boolean}>(
        'SELECT activo FROM sigpmat.departamentos WHERE id_departamento=$1::bigint FOR UPDATE',
        [request.params.id]);
      if(!actual.rowCount){await revertir(client);return reply.code(404).send({error:'Departamento no encontrado'});}
      if(b.activo===false && actual.rows[0].activo){
        const abiertos=await client.query(
          "SELECT 1 FROM sigpmat.turnos WHERE id_departamento=$1::bigint AND estado='abierto' AND fin_at>now() LIMIT 1",
          [request.params.id]);
        if(abiertos.rowCount){await revertir(client);return reply.code(409).send({error:'Antes de desactivar el departamento, cierra o cancela sus turnos abiertos.'});}
      }
      const r=await client.query(
        `UPDATE sigpmat.departamentos
         SET codigo=COALESCE($2::varchar,codigo),
             nombre=COALESCE($3::varchar,nombre),
             ubicacion=CASE WHEN $4::boolean THEN $5::varchar ELSE ubicacion END,
             extension=CASE WHEN $6::boolean THEN $7::varchar ELSE extension END,
             activo=COALESCE($8::boolean,activo)
         WHERE id_departamento=$1::bigint
         RETURNING id_departamento::text,codigo,nombre,ubicacion,extension,activo`,
        [request.params.id,b.codigo?.trim().toUpperCase()??null,b.nombre?.trim()??null,
         Object.hasOwn(b,'ubicacion'),b.ubicacion?.trim()||null,Object.hasOwn(b,'extension'),
         b.extension?.trim()||null,b.activo??null]);
      await client.query('COMMIT');
      return {departamento:r.rows[0]};
    }catch(e){await revertir(client);return status(e,request,reply)}
    finally{client.release();}
  });

  app.delete<{Params:Params}>('/api/departamentos/:id',{schema:{params}},async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    if(!await autorizar(request,reply,'ADMIN_GENERAL'))return reply;
    if(!valido(request.params.id))return reply.code(400).send({error:'ID inválido'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const departamento=await client.query(
        'SELECT 1 FROM sigpmat.departamentos WHERE id_departamento=$1::bigint FOR UPDATE',
        [request.params.id]);
      if(!departamento.rowCount){await revertir(client);return reply.code(404).send({error:'Departamento no encontrado'});}
      const dependencias=await client.query<{referencias:boolean}>(
        `SELECT (
          EXISTS(SELECT 1 FROM sigpmat.empleado_departamento WHERE id_departamento=$1::bigint)
          OR EXISTS(SELECT 1 FROM sigpmat.turnos WHERE id_departamento=$1::bigint)
          OR EXISTS(SELECT 1 FROM sigpmat.politicas_asignacion WHERE id_departamento=$1::bigint)
        ) AS referencias`,[request.params.id]);
      if(dependencias.rows[0]?.referencias){
        await revertir(client);
        return explicar(reply,409,'No se puede eliminar el departamento.',
          'Existen empleados adscritos, turnos o políticas históricas vinculadas al departamento.',
          'Resuelve primero los turnos abiertos y usa Desactivar para preservar su historial.','DEPARTAMENTO_CON_HISTORIAL');
      }
      await client.query('DELETE FROM sigpmat.departamentos WHERE id_departamento=$1::bigint',[request.params.id]);
      await client.query('COMMIT');
      return {eliminado:true,modo:'fisico'};
    }catch(e){await revertir(client);return status(e,request,reply);}
    finally{client.release();}
  });

  app.delete<{Params:Params}>('/api/empleados/:id',{schema:{params}},async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    if(!await autorizar(request,reply,'ADMIN_GENERAL'))return reply;
    if(!valido(request.params.id))return reply.code(400).send({error:'ID inválido'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const empleado=await client.query(
        'SELECT 1 FROM sigpmat.empleados WHERE id_empleado=$1::bigint FOR UPDATE',[request.params.id]);
      if(!empleado.rowCount){await revertir(client);return explicar(reply,404,
  'No se encontró el empleado.',
  'El expediente ya no existe o fue eliminado por otro administrador.',
  'Actualiza la lista de empleados y selecciona un registro vigente.','EMPLEADO_NO_ENCONTRADO');}
      const cuenta=await client.query('SELECT 1 FROM sigpmat.usuarios WHERE id_empleado=$1::bigint LIMIT 1',[request.params.id]);
      if(cuenta.rowCount){await revertir(client);return explicar(reply,409,
  'No se puede eliminar el empleado.',
  'Este expediente está vinculado a una cuenta de usuario del sistema.',
  'Conserva el expediente; la cuenta debe gestionarse desde Administración de usuarios antes de considerar su eliminación.','EMPLEADO_CON_CUENTA');}
      const historial=await client.query<{tiene:boolean}>(
        `SELECT (
          EXISTS(SELECT 1 FROM sigpmat.asignaciones_turno WHERE id_empleado=$1::bigint)
          OR EXISTS(SELECT 1 FROM sigpmat.solicitudes_ausencia WHERE id_empleado=$1::bigint)
          OR EXISTS(SELECT 1 FROM sigpmat.solicitudes_cambio WHERE id_empleado_propuesto=$1::bigint)
          OR EXISTS(SELECT 1 FROM sigpmat.propuestas_asignacion WHERE id_empleado=$1::bigint)
          OR EXISTS(SELECT 1 FROM sigpmat.disponibilidades WHERE id_empleado=$1::bigint)
          OR EXISTS(SELECT 1 FROM sigpmat.excepciones_disponibilidad WHERE id_empleado=$1::bigint)
          OR EXISTS(SELECT 1 FROM sigpmat.registros_asistencia ra JOIN sigpmat.asignaciones_turno at ON at.id_asignacion=ra.id_asignacion WHERE at.id_empleado=$1::bigint)
        ) AS tiene`,[request.params.id]);
      if(historial.rows[0]?.tiene){await revertir(client);return explicar(reply,409,
  'No se puede eliminar el empleado.',
  'Tiene asignaciones, disponibilidades, solicitudes u otros antecedentes vinculados.',
  'Consulta sus turnos y cancela las asignaciones activas cuando corresponda; utiliza Editar → Estado laboral → Inactivo para conservar el historial.','EMPLEADO_CON_HISTORIAL');}
      await client.query('DELETE FROM sigpmat.empleado_especialidad WHERE id_empleado=$1::bigint',[request.params.id]);
      await client.query('DELETE FROM sigpmat.empleado_departamento WHERE id_empleado=$1::bigint',[request.params.id]);
      await client.query('DELETE FROM sigpmat.empleados WHERE id_empleado=$1::bigint',[request.params.id]);
      await client.query('COMMIT');
      return {eliminado:true,modo:'fisico'};
    }catch(e){await revertir(client);return status(e,request,reply);}
    finally{client.release();}
  });

  app.patch<{Params:Params;Body:TurnoCambio}>('/api/turnos/:id',{
    schema:{params,body:{type:'object',additionalProperties:false,
      required:['id_departamento','tipo_turno','inicio_at','fin_at','id_cargo','id_especialidad','cupos_requeridos','prioridad'],
      properties:{
        id_departamento:id, id_cargo:id,
        id_especialidad:{anyOf:[id,{type:'null'}]},
        tipo_turno:{type:'string',enum:['diurno','nocturno','mixto','emergencia']},
        inicio_at:dt,fin_at:dt,
        cupos_requeridos:{type:'integer',minimum:1,maximum:200},
        prioridad:{type:'string',enum:['normal','alta','critica']}
      }}}
  },async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    if(!await autorizar(request,reply,'ADMIN_GENERAL'))return reply;
    const b=request.body;
    if(!valido(request.params.id)||!valido(b.id_departamento)||!valido(b.id_cargo)||
      (b.id_especialidad!==null&&!valido(b.id_especialidad)))return reply.code(400).send({error:'Identificador inválido'});
    const inicio=fecha(b.inicio_at),fin=fecha(b.fin_at);
    if(!inicio||!fin||inicio<=new Date()||fin<=inicio)
      return reply.code(422).send({error:'Las fechas del turno deben ser futuras y la finalización posterior al inicio.'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const turno=await client.query<{estado:string}>(
        'SELECT estado FROM sigpmat.turnos WHERE id_turno=$1::bigint FOR UPDATE',[request.params.id]);
      if(!turno.rowCount){await revertir(client);return reply.code(404).send({error:'Turno no encontrado'});}
      if(turno.rows[0].estado!=='abierto'){await revertir(client);return reply.code(409).send({error:'Solo se pueden editar turnos abiertos.'});}
      const req=await client.query<{id_requerimiento:string}>(
        'SELECT id_requerimiento::text FROM sigpmat.requerimientos_turno WHERE id_turno=$1::bigint FOR UPDATE',
        [request.params.id]);
      if(req.rowCount!==1){await revertir(client);return reply.code(409).send({error:'El turno debe tener exactamente un requerimiento para este formulario.'});}
      const a=await client.query(
        'SELECT 1 FROM sigpmat.asignaciones_turno WHERE id_requerimiento=$1::bigint LIMIT 1',
        [req.rows[0].id_requerimiento]);
      if(a.rowCount){await revertir(client);return reply.code(409).send({error:'Este turno tiene asignaciones. Para cambiar su programación conserva el historial: cancela las asignaciones o crea otro turno.'});}
      const catalogos=await client.query<{depto:boolean;cargo:boolean;especialidad:boolean}>(
        `SELECT
           EXISTS(SELECT 1 FROM sigpmat.departamentos WHERE id_departamento=$1::bigint AND activo) AS depto,
           EXISTS(SELECT 1 FROM sigpmat.cargos WHERE id_cargo=$2::bigint AND activo) AS cargo,
           ($3::bigint IS NULL OR EXISTS(SELECT 1 FROM sigpmat.especialidades WHERE id_especialidad=$3::bigint AND activo)) AS especialidad`,
        [b.id_departamento,b.id_cargo,b.id_especialidad]);
      if(!catalogos.rows[0]?.depto||!catalogos.rows[0]?.cargo||!catalogos.rows[0]?.especialidad){
        await revertir(client);return reply.code(422).send({error:'Departamento, cargo o especialidad inexistente o inactivo.'});
      }
      await client.query(
        `UPDATE sigpmat.turnos SET id_departamento=$2::bigint,tipo_turno=$3,
          inicio_at=$4::timestamptz,fin_at=$5::timestamptz
          WHERE id_turno=$1::bigint`,
        [request.params.id,b.id_departamento,b.tipo_turno,inicio.toISOString(),fin.toISOString()]);
      await client.query(
        `UPDATE sigpmat.requerimientos_turno
          SET id_cargo=$2::bigint,id_especialidad=$3::bigint,cupos_requeridos=$4,prioridad=$5
          WHERE id_requerimiento=$1::bigint`,
        [req.rows[0].id_requerimiento,b.id_cargo,b.id_especialidad,b.cupos_requeridos,b.prioridad]);
      await client.query('COMMIT');
      return {actualizado:true};
    }catch(e){await revertir(client);return status(e,request,reply);}
    finally{client.release();}
  });

  app.delete<{Params:Params}>('/api/turnos/:id',{schema:{params}},async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    if(!await autorizar(request,reply,'ADMIN_GENERAL'))return reply;
    if(!valido(request.params.id))return reply.code(400).send({error:'ID inválido'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const turno=await client.query(
        'SELECT 1 FROM sigpmat.turnos WHERE id_turno=$1::bigint FOR UPDATE',
        [request.params.id]);
      if(!turno.rowCount){await revertir(client);return reply.code(404).send({error:'Turno no encontrado'});}
      const hist=await client.query<{tiene:boolean}>(
        `SELECT (
          EXISTS(SELECT 1 FROM sigpmat.asignaciones_turno a JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento=a.id_requerimiento WHERE r.id_turno=$1::bigint)
          OR EXISTS(SELECT 1 FROM sigpmat.ejecuciones_asignacion WHERE id_turno=$1::bigint)
          OR EXISTS(SELECT 1 FROM sigpmat.propuestas_asignacion p JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento=p.id_requerimiento WHERE r.id_turno=$1::bigint)
          OR EXISTS(SELECT 1 FROM sigpmat.emergencias WHERE id_turno=$1::bigint)
        ) AS tiene`,[request.params.id]);
      if(hist.rows[0]?.tiene){await revertir(client);return explicar(reply,409,'No se puede eliminar el turno.',
  'Tiene asignaciones de personal u otros registros históricos vinculados.',
  'Revisa sus asignaciones y utiliza Cancelar turno cuando corresponda, para conservar la trazabilidad.','TURNO_CON_HISTORIAL');}
      await client.query('DELETE FROM sigpmat.requerimientos_turno WHERE id_turno=$1::bigint',[request.params.id]);
      await client.query('DELETE FROM sigpmat.turnos WHERE id_turno=$1::bigint',[request.params.id]);
      await client.query('COMMIT');
      return {eliminado:true,modo:'fisico'};
    }catch(e){await revertir(client);return status(e,request,reply);}
    finally{client.release();}
  });
}
