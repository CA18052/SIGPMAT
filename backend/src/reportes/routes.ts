import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { pool } from '../db.js';
import { autorizar } from '../auth/routes.js';

type Usuario = { id_usuario:string; roles:string[] };
type Periodo = { desde:string; hasta:string };
type Params = { id:string };

const idSchema = {type:'string',pattern:'^[1-9][0-9]{0,18}$',maxLength:19};
function fechaValida(s:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const f=new Date(s+'T00:00:00Z');
  return Number.isFinite(f.getTime()) && f.toISOString().slice(0,10)===s;
}
async function usuarioConAcceso(request:FastifyRequest,reply:FastifyReply) {
  const u=await autorizar(request,reply);
  if(!u)return null;
  if(!u.roles.some(r=>['ADMIN_GENERAL','JEFE_AREA','VISITANTE_LECTURA'].includes(r))){
    reply.code(403).send({error:'Tu cuenta no puede consultar reportes.'});
    return null;
  }
  return u;
}
async function departamentoAutorizado(u:Usuario,departamento:string){
  if(u.roles.includes('ADMIN_GENERAL'))return true;
  const r=await pool.query<{permitido:boolean}>(
    \`SELECT EXISTS (
       SELECT 1 FROM sigpmat.usuarios u
       JOIN sigpmat.empleados j ON j.id_empleado=u.id_empleado
       JOIN sigpmat.empleado_departamento ed ON ed.id_empleado=j.id_empleado
       JOIN sigpmat.departamentos d ON d.id_departamento=ed.id_departamento
       WHERE u.id_usuario=$1::bigint AND ed.id_departamento=$2::bigint
         AND j.estado_vinculo='activo' AND d.activo=TRUE AND ed.es_jefe=TRUE
         AND ed.fecha_inicio<=CURRENT_DATE
         AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=CURRENT_DATE)
    ) AS permitido\`,[u.id_usuario,departamento]);
  return r.rows[0]?.permitido===true;
}

type Area = {
  id_departamento:string; departamento:string; turnos:number; abiertos:number;
  cancelados:number; cupos:number; cubiertos:number; faltantes:number;
};
export function registrarRutasReportes(app:FastifyInstance):void {
  app.get<{Querystring:Periodo}>('/api/reportes/cobertura',{
    schema:{querystring:{type:'object',additionalProperties:false,
      required:['desde','hasta'],
      properties:{
        desde:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},
        hasta:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}
      }}}
  },async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    const u=await usuarioConAcceso(request,reply);
    if(!u)return reply;
    const {desde,hasta}=request.query;
    if(!fechaValida(desde)||!fechaValida(hasta))
      return reply.code(400).send({error:'Introduce fechas válidas.'});
    const diferencia=(Date.parse(hasta+'T00:00:00Z')-Date.parse(desde+'T00:00:00Z'))/86400000;
    if(diferencia<0||diferencia>366)
      return reply.code(400).send({error:'El período debe ser de entre 1 y 367 días.'});

    // Todo agregado en SQL antes de devolverlo. No se exponen datos de contacto.
    // Los roles ADMIN_GENERAL y VISITANTE_LECTURA ven áreas globales;
    // JEFE_AREA se restringe a su jefatura vigente.
    const {rows}=await pool.query<Area>(\`
      WITH areas AS (
        SELECT d.id_departamento,d.nombre
        FROM sigpmat.departamentos d
        WHERE d.activo=TRUE AND (
          $1::boolean OR EXISTS (
            SELECT 1 FROM sigpmat.usuarios u
            JOIN sigpmat.empleados j ON j.id_empleado=u.id_empleado
            JOIN sigpmat.empleado_departamento ed ON ed.id_empleado=j.id_empleado
            WHERE u.id_usuario=$2::bigint AND j.estado_vinculo='activo'
              AND ed.es_jefe=TRUE AND ed.id_departamento=d.id_departamento
              AND ed.fecha_inicio<=CURRENT_DATE
              AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=CURRENT_DATE)
          )
        )
      ),
      en_periodo AS (
        SELECT t.id_turno,t.id_departamento,t.estado
        FROM sigpmat.turnos t
        WHERE t.inicio_at>=($3::date::timestamp AT TIME ZONE 'America/El_Salvador')
          AND t.inicio_at<(($4::date+1)::timestamp AT TIME ZONE 'America/El_Salvador')
      ),
      necesidades AS (
        SELECT r.id_turno,SUM(r.cupos_requeridos)::integer AS cupos
        FROM sigpmat.requerimientos_turno r
        JOIN en_periodo ep ON ep.id_turno=r.id_turno
        GROUP BY r.id_turno
      ),
      ocupacion AS (
        SELECT r.id_turno,COUNT(*)::integer AS cubiertos
        FROM sigpmat.asignaciones_turno a
        JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento=a.id_requerimiento
        JOIN en_periodo ep ON ep.id_turno=r.id_turno
        WHERE a.estado IN ('asignada','confirmada')
        GROUP BY r.id_turno
      ),
      turnos AS (
        SELECT ep.id_turno,ep.id_departamento,ep.estado,
               COALESCE(n.cupos,0) AS cupos,
               COALESCE(o.cubiertos,0) AS cubiertos
        FROM en_periodo ep LEFT JOIN necesidades n ON n.id_turno=ep.id_turno
        LEFT JOIN ocupacion o ON o.id_turno=ep.id_turno
      )
      SELECT d.id_departamento::text,d.nombre AS departamento,
             COUNT(t.id_turno)::integer AS turnos,
             COUNT(t.id_turno) FILTER (WHERE t.estado='abierto')::integer AS abiertos,
             COUNT(t.id_turno) FILTER (WHERE t.estado='cancelado')::integer AS cancelados,
             COALESCE(SUM(t.cupos) FILTER (WHERE t.estado='abierto'),0)::integer AS cupos,
             COALESCE(SUM(t.cubiertos) FILTER (WHERE t.estado='abierto'),0)::integer AS cubiertos,
             COALESCE(SUM(GREATEST(t.cupos-t.cubiertos,0))
               FILTER (WHERE t.estado='abierto'),0)::integer AS faltantes
      FROM areas d LEFT JOIN turnos t ON t.id_departamento=d.id_departamento
      GROUP BY d.id_departamento,d.nombre
      ORDER BY faltantes DESC,d.nombre
    \`,[u.roles.includes('ADMIN_GENERAL')||u.roles.includes('VISITANTE_LECTURA'),
       u.id_usuario,desde,hasta]);
    const totales=rows.reduce((sum,a)=>({
      turnos:sum.turnos+a.turnos,abiertos:sum.abiertos+a.abiertos,
      cancelados:sum.cancelados+a.cancelados,cupos:sum.cupos+a.cupos,
      cubiertos:sum.cubiertos+a.cubiertos,faltantes:sum.faltantes+a.faltantes
    }),{turnos:0,abiertos:0,cancelados:0,cupos:0,cubiertos:0,faltantes:0});
    return {desde,hasta,totales,departamentos:rows,
      porcentaje:totales.cupos>0?Math.round(totales.cubiertos*100/totales.cupos):0,
      nota:'Cobertura de turnos abiertos, según asignaciones activas; se excluyen los cancelados.'};
  });

  // Recomendación DETERMINISTA, sin modelo ML: mismo conjunto de restricciones
  // que valida el trigger de PostgreSQL al insertar una asignación. No escribe.
  app.get<{Params:Params}>('/api/turnos/:id/sugerencias',{
    schema:{params:{type:'object',required:['id'],additionalProperties:false,
      properties:{id:idSchema}}}
  },async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    const u=await autorizar(request,reply);
    if(!u)return reply;
    if(!u.roles.some(r=>r==='ADMIN_GENERAL'||r==='JEFE_AREA')){
      return reply.code(403).send({error:'Solo administradores y jefes de área pueden consultar propuestas.'});
    }
    const {id}=request.params;
    if(BigInt(id)>9223372036854775807n)
      return reply.code(400).send({error:'Identificador de turno inválido.'});
    const {rows}=await pool.query<{
      id_turno:string;id_departamento:string;estado:string;
      inicio_at:string;fin_at:string
    }>(\`SELECT id_turno::text,id_departamento::text,estado,inicio_at,fin_at
       FROM sigpmat.turnos WHERE id_turno=$1::bigint\`,[id]);
    const turno=rows[0];
    if(!turno||!await departamentoAutorizado(u,turno.id_departamento))
      return reply.code(404).send({error:'Turno no encontrado o fuera de tu departamento.'});
    if(turno.estado!=='abierto'||new Date(turno.inicio_at)<=new Date())
      return {id_turno:id,habilitado:false,
        motivo:'Las sugerencias solo están disponibles para turnos abiertos que aún no comienzan.',
        requerimientos:[]};

    const {rows:requerimientos}=await pool.query<{
      id_requerimiento:string;cargo:string;especialidad:string|null;
      cupos_requeridos:number;cupos_ocupados:number
    }>(\`SELECT r.id_requerimiento::text,c.nombre AS cargo,
         s.nombre AS especialidad,r.cupos_requeridos,
         (SELECT COUNT(*)::integer FROM sigpmat.asignaciones_turno a
          WHERE a.id_requerimiento=r.id_requerimiento
            AND a.estado IN ('asignada','confirmada')) AS cupos_ocupados
        FROM sigpmat.requerimientos_turno r
        JOIN sigpmat.cargos c ON c.id_cargo=r.id_cargo
        LEFT JOIN sigpmat.especialidades s ON s.id_especialidad=r.id_especialidad
        WHERE r.id_turno=$1::bigint ORDER BY r.id_requerimiento\`,[id]);

    const detallados=[];
    for(const req of requerimientos){
      const faltantes=Math.max(0,req.cupos_requeridos-req.cupos_ocupados);
      if(faltantes===0){
        detallados.push({...req,faltantes,candidatos:[]});
        continue;
      }
      const {rows:candidatos}=await pool.query<{
        id_empleado:string;codigo_empleado:string;nombre_completo:string;
        turnos_recientes:number
      }>(\`
        SELECT e.id_empleado::text,e.codigo_empleado,
          (e.nombres||' '||e.apellidos) AS nombre_completo,
          (SELECT COUNT(*)::integer
           FROM sigpmat.asignaciones_turno ax
           JOIN sigpmat.requerimientos_turno rx
             ON rx.id_requerimiento=ax.id_requerimiento
           JOIN sigpmat.turnos tx ON tx.id_turno=rx.id_turno
           WHERE ax.id_empleado=e.id_empleado
             AND ax.estado IN ('asignada','confirmada')
             AND tx.estado<>'cancelado'
             AND tx.inicio_at>=now()-interval '30 days'
             AND tx.inicio_at<now()+interval '30 days') AS turnos_recientes
        FROM sigpmat.empleados e
        JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento=$1::bigint
        JOIN sigpmat.turnos t ON t.id_turno=r.id_turno
        WHERE e.estado_vinculo='activo' AND e.id_cargo=r.id_cargo
          AND EXISTS (
            SELECT 1 FROM sigpmat.empleado_departamento ed
            WHERE ed.id_empleado=e.id_empleado
              AND ed.id_departamento=t.id_departamento
              AND ed.fecha_inicio<=(t.inicio_at AT TIME ZONE 'America/El_Salvador')::date
              AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=
                ((t.fin_at-interval '1 microsecond') AT TIME ZONE 'America/El_Salvador')::date)
          )
          AND (r.id_especialidad IS NULL OR EXISTS (
            SELECT 1 FROM sigpmat.empleado_especialidad ee
            JOIN sigpmat.especialidades sp ON sp.id_especialidad=ee.id_especialidad
            WHERE ee.id_empleado=e.id_empleado
              AND ee.id_especialidad=r.id_especialidad AND sp.activo=TRUE
              AND ee.fecha_acreditacion<=t.inicio_at::date
              AND ee.vigente_desde<=t.inicio_at::date
              AND (ee.vigente_hasta IS NULL OR
                ee.vigente_hasta>=(t.fin_at-interval '1 microsecond')::date)
          ))
          AND NOT EXISTS (
            SELECT 1 FROM sigpmat.asignaciones_turno ax
            JOIN sigpmat.requerimientos_turno rx ON rx.id_requerimiento=ax.id_requerimiento
            JOIN sigpmat.turnos tx ON tx.id_turno=rx.id_turno
            WHERE ax.id_empleado=e.id_empleado
              AND ax.estado IN ('asignada','confirmada')
              AND tx.estado<>'cancelado'
              AND tx.inicio_at<t.fin_at AND t.inicio_at<tx.fin_at
          )
          AND NOT EXISTS (
            SELECT 1 FROM sigpmat.solicitudes_ausencia au
            WHERE au.id_empleado=e.id_empleado AND au.estado='aprobada'
              AND au.inicio_at<t.fin_at AND t.inicio_at<au.fin_at
          )
          AND NOT EXISTS (
            SELECT 1 FROM sigpmat.excepciones_disponibilidad ex
            WHERE ex.id_empleado=e.id_empleado AND ex.tipo='no_disponible'
              AND ex.inicio_at<t.fin_at AND t.inicio_at<ex.fin_at
          )
        ORDER BY turnos_recientes ASC,e.apellidos,e.nombres,e.id_empleado
        LIMIT 5
      \`,[req.id_requerimiento]);
      detallados.push({...req,faltantes,candidatos});
    }
    return {id_turno:id,habilitado:true,requerimientos:detallados,
      criterios:['Cargo compatible','Departamento vigente',
        'Especialidad vigente cuando corresponde','Sin solapamientos',
        'Sin ausencias aprobadas ni excepciones de no disponibilidad',
        'Menor carga de turnos recientes primero'],
      aviso:'Propuestas orientativas basadas en reglas; la asignación final se valida nuevamente en PostgreSQL y requiere confirmación humana.'};
  });
}
