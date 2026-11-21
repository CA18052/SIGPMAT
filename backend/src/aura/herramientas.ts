import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { crearPropuesta } from './propuestas.js';

export type ActorAura = {id_usuario:string;nombre_usuario:string;roles:string[]};
export type ContextoAura = {app:FastifyInstance;token:string;usuario:ActorAura};
type Argumentos = Record<string,unknown>;
const idValido=(id:unknown):id is string=>typeof id==='string'&&/^[1-9][0-9]{0,17}$/.test(id);
const texto=(v:unknown,max=90)=>typeof v==='string'?v.trim().slice(0,max):'';
const puedeEscribir=(u:ActorAura)=>u.roles.some(r=>r==='ADMIN_GENERAL'||r==='JEFE_AREA')
  &&!u.roles.includes('VISITANTE_LECTURA');
const esAdmin=(u:ActorAura)=>u.roles.includes('ADMIN_GENERAL');
const fechaHora=(s:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?-06:00$/.test(s)
  && Number.isFinite(Date.parse(s));
const error=(mensaje:string)=>({error:mensaje});

async function areaPermitida(u:ActorAura,id:string,escritura:boolean){
  if(escritura && !puedeEscribir(u))return false;
  if(esAdmin(u))return true;
  if(!escritura && u.roles.includes('VISITANTE_LECTURA'))return true;
  const {rows}=await pool.query<{permitido:boolean}>(`
    SELECT EXISTS (
      SELECT 1 FROM sigpmat.usuarios u
      JOIN sigpmat.empleados e ON e.id_empleado=u.id_empleado
      JOIN sigpmat.empleado_departamento ed ON ed.id_empleado=e.id_empleado
      WHERE u.id_usuario=$1::bigint AND e.estado_vinculo='activo'
        AND ed.id_departamento=$2::bigint AND ed.es_jefe=TRUE
        AND ed.fecha_inicio<=CURRENT_DATE
        AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=CURRENT_DATE)
    ) AS permitido
  `,[u.id_usuario,id]);
  return rows[0]?.permitido===true;
}
async function recurso(ctx:ContextoAura,ruta:string){
  const res=await ctx.app.inject({method:'GET',url:ruta,
    headers:{authorization:ctx.token}});
  let body:unknown;
  try{body=res.json();}catch{body={error:'No se pudo obtener la información'};}
  return res.statusCode>=400?{error:'Consulta no disponible',status:res.statusCode,detalle:body}:body;
}
async function catalogos(ctx:ContextoAura){
  const [depts,cargos,especialidades]=await Promise.all([
    recurso(ctx,'/api/departamentos'),recurso(ctx,'/api/cargos'),recurso(ctx,'/api/especialidades')
  ]);
  const d=depts as {departamentos?:Array<Record<string,unknown>>;error?:string};
  const c=cargos as {cargos?:Array<Record<string,unknown>>;error?:string};
  const e=especialidades as {especialidades?:Array<Record<string,unknown>>;error?:string};
  return {
    departamentos:d.departamentos?.map(x=>({id_departamento:x.id_departamento,nombre:x.nombre,codigo:x.codigo})).slice(0,30)??[],
    cargos:c.cargos?.map(x=>({id_cargo:x.id_cargo,nombre:x.nombre})).slice(0,40)??[],
    especialidades:e.especialidades?.map(x=>({id_especialidad:x.id_especialidad,nombre:x.nombre})).slice(0,40)??[],
    ...(d.error||c.error||e.error?{aviso:'Algunos catálogos no están disponibles para este usuario.'}:{})
  };
}

async function disponibles(ctx:ContextoAura,a:Argumentos){
  const dep=a.id_departamento,cargo=a.id_cargo,
    inicio=texto(a.inicio_at,40),fin=texto(a.fin_at,40);
  if(!idValido(dep)||!idValido(cargo)||!fechaHora(inicio)||!fechaHora(fin)||
    Date.parse(fin)<=Date.parse(inicio)){
    return error('Especifica departamento, cargo y horario exacto de inicio y fin, con zona -06:00 de El Salvador. No supongas el horario mixto.');
  }
  if(!await areaPermitida(ctx.usuario,dep,false))
    return error('Departamento fuera del alcance de tu perfil.');
  const esp=idValido(a.id_especialidad)?a.id_especialidad:null;
  const {rows}=await pool.query<{
    id_empleado:string;codigo_empleado:string;nombre_completo:string;
    cargo:string;turnos_recientes:number
  }>(`
    SELECT e.id_empleado::text,e.codigo_empleado,
      (e.nombres||' '||e.apellidos) AS nombre_completo,
      c.nombre AS cargo,
      (SELECT COUNT(*)::integer FROM sigpmat.asignaciones_turno ax
        JOIN sigpmat.requerimientos_turno rx ON rx.id_requerimiento=ax.id_requerimiento
        JOIN sigpmat.turnos tx ON tx.id_turno=rx.id_turno
        WHERE ax.id_empleado=e.id_empleado AND ax.estado IN ('asignada','confirmada')
          AND tx.estado<>'cancelado'
          AND tx.inicio_at>=now()-interval '30 days'
          AND tx.inicio_at<now()+interval '30 days') AS turnos_recientes
    FROM sigpmat.empleados e
    JOIN sigpmat.cargos c ON c.id_cargo=e.id_cargo
    WHERE e.estado_vinculo='activo' AND e.id_cargo=$2::bigint
      AND EXISTS(SELECT 1 FROM sigpmat.empleado_departamento ed
        WHERE ed.id_empleado=e.id_empleado AND ed.id_departamento=$1::bigint
          AND ed.fecha_inicio<=($3::timestamptz AT TIME ZONE 'America/El_Salvador')::date
          AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=
            (($4::timestamptz-interval '1 microsecond') AT TIME ZONE 'America/El_Salvador')::date))
      AND ($5::bigint IS NULL OR EXISTS(
        SELECT 1 FROM sigpmat.empleado_especialidad ee
        JOIN sigpmat.especialidades sp ON sp.id_especialidad=ee.id_especialidad
        WHERE ee.id_empleado=e.id_empleado AND ee.id_especialidad=$5::bigint AND sp.activo=TRUE
          AND ee.fecha_acreditacion<=($3::timestamptz AT TIME ZONE 'America/El_Salvador')::date
          AND ee.vigente_desde<=($3::timestamptz AT TIME ZONE 'America/El_Salvador')::date
          AND (ee.vigente_hasta IS NULL OR ee.vigente_hasta>=
            (($4::timestamptz-interval '1 microsecond') AT TIME ZONE 'America/El_Salvador')::date)))
      AND NOT EXISTS(
        SELECT 1 FROM sigpmat.asignaciones_turno ax
        JOIN sigpmat.requerimientos_turno rx ON rx.id_requerimiento=ax.id_requerimiento
        JOIN sigpmat.turnos tx ON tx.id_turno=rx.id_turno
        WHERE ax.id_empleado=e.id_empleado AND ax.estado IN ('asignada','confirmada')
          AND tx.estado<>'cancelado' AND tx.inicio_at<$4::timestamptz
          AND tx.fin_at>$3::timestamptz)
      AND NOT EXISTS(SELECT 1 FROM sigpmat.solicitudes_ausencia au
        WHERE au.id_empleado=e.id_empleado AND au.estado='aprobada'
          AND au.inicio_at<$4::timestamptz AND au.fin_at>$3::timestamptz)
      AND NOT EXISTS(SELECT 1 FROM sigpmat.excepciones_disponibilidad ex
        WHERE ex.id_empleado=e.id_empleado AND ex.tipo='no_disponible'
          AND ex.inicio_at<$4::timestamptz AND ex.fin_at>$3::timestamptz)
    ORDER BY turnos_recientes,e.apellidos,e.nombres LIMIT 12
  `,[dep,cargo,inicio,fin,esp]);
  return {departamento:dep,cargo,horario:{inicio,fin},
    candidatos:rows,criterio:'Elegibles por registros actuales; las reglas se validan otra vez al asignar.',
    advertencia:'Sin conflicto registrado no garantiza disponibilidad física ni reemplaza la confirmación del profesional.'};
}

async function prepararTurno(ctx:ContextoAura,a:Argumentos){
  if(!puedeEscribir(ctx.usuario))return error('Tu cuenta solo permite consultas.');
  const dep=a.id_departamento,cargo=a.id_cargo,esp=a.id_especialidad,
    tipo=texto(a.tipo_turno,30),inicio=texto(a.inicio_at,40),fin=texto(a.fin_at,40),
    cupos=a.cupos_requeridos,prioridad=texto(a.prioridad,20)||'normal';
  if(!idValido(dep)||!idValido(cargo)||
    (esp!==undefined&&esp!==null&&!idValido(esp))||
    !['diurno','nocturno','mixto','emergencia'].includes(tipo)||
    !fechaHora(inicio)||!fechaHora(fin)||Date.parse(inicio)<=Date.now()||
    Date.parse(fin)<=Date.parse(inicio)||
    typeof cupos!=='number'||!Number.isInteger(cupos)||cupos<1||cupos>200||
    !['normal','alta','critica'].includes(prioridad))
    return error('Faltan datos o son inválidos. Solicita departamento, cargo, jornada, inicio, fin exactos en zona -06:00 y cupos. No inventes valores.');
  if(!await areaPermitida(ctx.usuario,dep,true))
    return error('No tienes permiso de gestionar ese departamento.');
  const {rows}=await pool.query<{departamento:string;cargo:string}>(
    `SELECT d.nombre AS departamento,c.nombre AS cargo FROM sigpmat.departamentos d
      CROSS JOIN sigpmat.cargos c WHERE d.id_departamento=$1::bigint AND d.activo
      AND c.id_cargo=$2::bigint AND c.activo`,[dep,cargo]);
  if(!rows[0])return error('Departamento o cargo no existe o está inactivo.');
  const datos={id_departamento:dep,id_cargo:cargo,id_especialidad:esp??null,
    tipo_turno:tipo,inicio_at:inicio,fin_at:fin,
    cupos_requeridos:cupos,prioridad};
  return {propuesta:crearPropuesta(ctx.usuario.id_usuario,'crear_turno','/api/turnos',datos,
    'Crear turno '+tipo+' de '+rows[0].departamento+' para '+cupos+' '+rows[0].cargo+
    '(s). Inicio: '+inicio+' · Fin: '+fin+'.'),
    mensaje:'Propuesta preparada, SIN guardar. El usuario debe revisarla y confirmar su contraseña. Las asignaciones se propondrán después de crear el turno.'};
}

async function prepararEmpleado(ctx:ContextoAura,a:Argumentos){
  if(!esAdmin(ctx.usuario))return error('Solamente ADMIN_GENERAL puede crear empleados.');
  const codigo=texto(a.codigo_empleado,30),nombres=texto(a.nombres,100),
    apellidos=texto(a.apellidos,100),cargo=a.id_cargo,dep=a.id_departamento;
  const fecha=texto(a.fecha_ingreso,10);
  if(!/^[A-Za-z0-9-]{3,20}$/.test(codigo)||!nombres||nombres.length>90||
    !apellidos||apellidos.length>90||!idValido(cargo)||!idValido(dep)||
    (fecha!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(fecha)))
    return error('Indica código de empleado, nombres, apellidos, cargo y departamento válidos. No inventes documentos, registros ni contactos.');
  const {rows}=await pool.query<{dep:string;cargo:string}>(
    `SELECT d.nombre AS dep,c.nombre AS cargo FROM sigpmat.departamentos d
     CROSS JOIN sigpmat.cargos c WHERE d.id_departamento=$1::bigint AND d.activo
     AND c.id_cargo=$2::bigint AND c.activo`,[dep,cargo]);
  if(!rows[0])return error('El cargo o departamento no está activo.');
  const dup=await pool.query('SELECT 1 FROM sigpmat.empleados WHERE codigo_empleado=$1 LIMIT 1',[codigo]);
  if(dup.rowCount)return error('Ya existe ese código de empleado. Solicita otro.');
  const datos:Record<string,unknown>={codigo_empleado:codigo,nombres,apellidos,
    id_cargo:cargo,id_departamento:dep};
  if(fecha)datos.fecha_ingreso=fecha;
  return {propuesta:crearPropuesta(ctx.usuario.id_usuario,'crear_empleado','/api/empleados',datos,
    'Registrar a '+nombres+' '+apellidos+' ('+codigo+') en '+rows[0].dep+
    ' como '+rows[0].cargo+'.'),
    mensaje:'Expediente propuesto sin DUI ni datos sensibles. No se guardará hasta aprobar y confirmar la contraseña.'};
}

async function prepararAsignacion(ctx:ContextoAura,a:Argumentos){
  if(!puedeEscribir(ctx.usuario))return error('No tienes permisos de asignación.');
  const turno=a.id_turno,req=a.id_requerimiento,empleado=a.id_empleado;
  if(!idValido(turno)||!idValido(req)||!idValido(empleado))
    return error('Indica IDs de turno, requerimiento y empleado.');
  const sugerencias=await recurso(ctx,'/api/turnos/'+turno+'/sugerencias') as {
    habilitado?:boolean;requerimientos?:Array<{
      id_requerimiento:string;candidatos:Array<{
        id_empleado:string;nombre_completo:string
      }>}>;error?:string
  };
  if(!sugerencias.habilitado)return error('No es posible asignar en este turno. Debe estar abierto y ser futuro.');
  const r=sugerencias.requerimientos?.find(x=>x.id_requerimiento===req);
  const p=r?.candidatos?.find(x=>x.id_empleado===empleado);
  if(!p)return error('La persona no está entre las recomendaciones elegibles actuales. Verifica cobertura y restricciones.');
  return {propuesta:crearPropuesta(ctx.usuario.id_usuario,'asignar_empleado',
    '/api/turnos/'+turno+'/asignaciones',
    {id_empleado:empleado,id_requerimiento:req},
    'Asignar a '+p.nombre_completo+' al turno #'+turno+' (requerimiento #'+req+').'),
    mensaje:'Asignación preparada. Debe confirmarse con contraseña y el trigger de PostgreSQL revalidará su elegibilidad.'};
}

export const herramientasAura=[
  {type:'function',name:'consultar_catalogos',description:'Listar departamentos, cargos y especialidades con sus IDs para otras consultas y borradores.',
    parameters:{type:'object',properties:{},additionalProperties:false}},
  {type:'function',name:'consultar_cobertura',description:'Consultar cobertura agregada por departamento y cupos sin cubrir. Fechas YYYY-MM-DD.',
    parameters:{type:'object',properties:{desde:{type:'string'},hasta:{type:'string'}},required:['desde','hasta'],additionalProperties:false}},
  {type:'function',name:'buscar_turnos',description:'Buscar turnos por nombre de profesional asignado, código, departamento o número de turno.',
    parameters:{type:'object',properties:{busqueda:{type:'string'}},required:['busqueda'],additionalProperties:false}},
  {type:'function',name:'consultar_recomendaciones_turno',description:'Consultar candidatos elegibles para un turno existente por ID.',
    parameters:{type:'object',properties:{id_turno:{type:'string'}},required:['id_turno'],additionalProperties:false}},
  {type:'function',name:'buscar_personal_disponible',description:'Buscar personal sin conflictos registrados en un intervalo exacto. Primero consultar IDs de catálogos. Fecha ISO con -06:00.',
    parameters:{type:'object',properties:{
      id_departamento:{type:'string'},id_cargo:{type:'string'},
      id_especialidad:{type:['string','null']},inicio_at:{type:'string'},fin_at:{type:'string'}
    },required:['id_departamento','id_cargo','inicio_at','fin_at'],additionalProperties:false}},
  {type:'function',name:'preparar_turno',description:'Preparar borrador de turno NUEVO para aprobación humana. No crea nada. Exige horario preciso de El Salvador -06:00.',
    parameters:{type:'object',properties:{
      id_departamento:{type:'string'},id_cargo:{type:'string'},
      id_especialidad:{type:['string','null']},tipo_turno:{type:'string'},
      inicio_at:{type:'string'},fin_at:{type:'string'},
      cupos_requeridos:{type:'integer'},prioridad:{type:'string'}
    },required:['id_departamento','id_cargo','tipo_turno','inicio_at','fin_at','cupos_requeridos'],additionalProperties:false}},
  {type:'function',name:'preparar_empleado',description:'Preparar borrador administrativo de empleado con datos no sensibles. Solo ADMIN_GENERAL. No inventar campos.',
    parameters:{type:'object',properties:{
      codigo_empleado:{type:'string'},nombres:{type:'string'},apellidos:{type:'string'},
      id_cargo:{type:'string'},id_departamento:{type:'string'},fecha_ingreso:{type:'string'}
    },required:['codigo_empleado','nombres','apellidos','id_cargo','id_departamento'],additionalProperties:false}},
  {type:'function',name:'preparar_asignacion',description:'Preparar asignación de candidato recomendado para turno EXISTENTE, con aprobación humana.',
    parameters:{type:'object',properties:{
      id_turno:{type:'string'},id_requerimiento:{type:'string'},id_empleado:{type:'string'}
    },required:['id_turno','id_requerimiento','id_empleado'],additionalProperties:false}}
] as const;

export async function ejecutarHerramientaAura(
  ctx:ContextoAura,nombre:string,args:Argumentos
):Promise<unknown>{
  switch(nombre){
    case 'consultar_catalogos':return catalogos(ctx);
    case 'consultar_cobertura':{
      const desde=texto(args.desde,10),hasta=texto(args.hasta,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(desde)||!/^\d{4}-\d{2}-\d{2}$/.test(hasta))
        return error('Introduce fechas YYYY-MM-DD.');
      return recurso(ctx,'/api/reportes/cobertura?desde='+desde+'&hasta='+hasta);
    }
    case 'buscar_turnos':{
      const q=texto(args.busqueda,80);
      const r=await recurso(ctx,'/api/turnos?q='+encodeURIComponent(q)) as {
        turnos?:unknown[];error?:string
      };
      return r.turnos?{turnos:r.turnos.slice(0,15),aviso:'Primeros 15 resultados visibles.'}:r;
    }
    case 'consultar_recomendaciones_turno':{
      if(!idValido(args.id_turno))return error('ID de turno inválido.');
      return recurso(ctx,'/api/turnos/'+args.id_turno+'/sugerencias');
    }
    case 'buscar_personal_disponible':return disponibles(ctx,args);
    case 'preparar_turno':return prepararTurno(ctx,args);
    case 'preparar_empleado':return prepararEmpleado(ctx,args);
    case 'preparar_asignacion':return prepararAsignacion(ctx,args);
    default:return error('La herramienta solicitada no está autorizada.');
  }
}
