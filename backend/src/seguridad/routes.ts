import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { pool } from '../db.js';
import { autorizar } from '../auth/routes.js';

type Identidad = { id_usuario:string; nombre_usuario:string; roles:string[];
  es_superadministrador:boolean };
type ConActor = FastifyRequest & { actorOperacion?:Identidad };
const MUTAR=new Set(['POST','PATCH','PUT','DELETE']);
const EXENTAS=new Set([
  '/api/auth/login','/api/auth/registrar','/api/auth/cambiar-contrasena',
  '/api/auth/confirmar-operacion'
]);
const limpio=(p:string)=>p.split('?')[0];
const huella=(token:string)=>createHash('sha256').update(token).digest('hex');

// Seguridad en DOS niveles: contraseña para solicitar el comprobante y
// comprobante de un solo uso vinculado a usuario+método+ruta para la escritura.
export function registrarSeguridadOperaciones(app:FastifyInstance):void {
  app.post<{Body:{contrasena:string;metodo:string;ruta:string}}>(
    '/api/auth/confirmar-operacion',{
      config:{rateLimit:{max:6,timeWindow:'1 minute'}},
      schema:{body:{type:'object',additionalProperties:false,
        required:['contrasena','metodo','ruta'],
        properties:{
          contrasena:{type:'string',minLength:1,maxLength:128},
          metodo:{type:'string',enum:['POST','PATCH','PUT','DELETE']},
          ruta:{type:'string',minLength:5,maxLength:250,pattern:'^/api/[a-zA-Z0-9/_-]+$'}
        }}}
    },async(request,reply)=>{
      reply.header('Cache-Control','no-store');
      const usuario=await autorizar(request,reply);
      if(!usuario)return reply;
      if(usuario.roles.includes('VISITANTE_LECTURA') ||
         !usuario.roles.some(r=>r==='ADMIN_GENERAL'||r==='JEFE_AREA')){
        return reply.code(403).send({error:'Esta cuenta tiene acceso exclusivo de lectura.'});
      }
      const {metodo,ruta,contrasena}=request.body;
      if(EXENTAS.has(ruta))return reply.code(400).send({error:'La operación no requiere confirmación.'});
      const {rows}=await pool.query<{contrasena_hash:string}>(
        "SELECT contrasena_hash FROM sigpmat.usuarios WHERE id_usuario=$1::bigint AND estado='activa'",
        [usuario.id_usuario]);
      const valido=rows[0] && await argon2.verify(rows[0].contrasena_hash,contrasena).catch(()=>false);
      if(!valido)return reply.code(401).send({error:'La contraseña de confirmación es incorrecta.'});
      const token=randomBytes(32).toString('base64url');
      // Debe permanecer válido solamente 60 s, un uso.
      await pool.query(
        `INSERT INTO sigpmat.confirmaciones_operacion
           (token_hash,id_usuario,metodo,ruta,expira_at)
         VALUES($1,$2::bigint,$3,$4,now()+interval '60 seconds')`,
        [huella(token),usuario.id_usuario,metodo,ruta]);
      return {confirmacion:token,expira_en_segundos:60};
    }
  );

  app.get<{Querystring:{limite?:number}}>(
    '/api/admin/auditoria',{
      schema:{querystring:{type:'object',additionalProperties:false,
        properties:{limite:{type:'integer',minimum:1,maximum:100}}}}
    },async(request,reply)=>{
      reply.header('Cache-Control','no-store');
      const u=await autorizar(request,reply,'ADMIN_GENERAL');
      if(!u)return reply;
      if(!u.es_superadministrador)
        return reply.code(403).send({error:'Auditoría exclusiva del superadministrador.'});
      const {rows}=await pool.query(
        `SELECT id_auditoria::text,fecha_at,nombre_usuario,metodo,ruta,
                resultado,codigo_http,campos_afectados,request_id
           FROM sigpmat.auditoria_seguridad
          ORDER BY fecha_at DESC,id_auditoria DESC LIMIT $1::integer`,
        [request.query.limite??100]);
      return {eventos:rows,limite:request.query.limite??100};
    }
  );

  app.addHook('preHandler',async(request,reply)=>{
    const ruta=limpio(request.url);
    if(!MUTAR.has(request.method)||!ruta.startsWith('/api/')||EXENTAS.has(ruta))return;
    reply.header('Cache-Control','no-store');
    const u=await autorizar(request,reply);
    if(!u)return reply;
    (request as ConActor).actorOperacion=u;
    if(u.roles.includes('VISITANTE_LECTURA')){
      return reply.code(403).send({error:'Tu cuenta solo permite consultar información.',
        motivo:'El registro público no concede privilegios administrativos.',
        solucion:'Solicita al superadministrador una cuenta operativa si te corresponde.'});
    }
    const comprobante=request.headers['x-sigpmat-confirmacion'];
    if(typeof comprobante!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(comprobante)){
      return reply.code(428).send({
        error:'Confirma tu contraseña para realizar esta operación.',
        codigo:'REAUTENTICACION_REQUERIDA'
      });
    }
    const {rowCount}=await pool.query(
      `UPDATE sigpmat.confirmaciones_operacion SET usado_at=now()
         WHERE token_hash=$1 AND id_usuario=$2::bigint AND metodo=$3
           AND ruta=$4 AND usado_at IS NULL AND expira_at>now()`,
      [huella(comprobante),u.id_usuario,request.method,ruta]);
    if(rowCount!==1)return reply.code(428).send({
      error:'La confirmación expiró o ya fue utilizada. Ingresa tu contraseña de nuevo.',
      codigo:'REAUTENTICACION_REQUERIDA'
    });
  });

  app.addHook('onResponse',async(request,reply)=>{
    const ruta=limpio(request.url);
    const esPublico=ruta==='/api/auth/registrar'&&request.method==='POST'&&reply.statusCode===201;
    const esCambio=MUTAR.has(request.method)&&ruta.startsWith('/api/')&&!EXENTAS.has(ruta);
    if(!esCambio&&!esPublico)return;
    const actor=(request as ConActor).actorOperacion;
    if(!actor&&!esPublico)return;
    const bruto=request.body;
    const campos=(bruto&&typeof bruto==='object'&&!Array.isArray(bruto))
      ? Object.keys(bruto).filter(k=>!/(contrasena|password|clave|dui|correo|telefono|foto|token|secret)/i.test(k)).slice(0,18)
      : [];
    const resultado=reply.statusCode<400?'EXITOSO':reply.statusCode<500?'RECHAZADO':'ERROR';
    const carnet=esPublico && bruto&&typeof bruto==='object'&&'carnet' in bruto
      ? String((bruto as {carnet:unknown}).carnet).slice(0,50) : null;
    try{
      await pool.query(
        `INSERT INTO sigpmat.auditoria_seguridad
           (id_usuario,nombre_usuario,metodo,ruta,resultado,codigo_http,campos_afectados,request_id)
         VALUES($1::bigint,$2,$3,$4,$5,$6,$7,$8)`,
        [actor?.id_usuario??null,actor?.nombre_usuario??carnet,request.method,
         ruta.slice(0,250),resultado,reply.statusCode,campos,String(request.id).slice(0,120)]);
    }catch(e){request.log.error({err:e},'No se pudo escribir evento de auditoría');}
  });
}
