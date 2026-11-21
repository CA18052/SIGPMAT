import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import argon2 from 'argon2';
import { pool } from '../db.js';
import { autorizar } from '../auth/routes.js';

type TipoCuenta = 'integrante' | 'docente';
type CuentaNueva = {
  nombre_usuario: string;
  nombre_mostrado: string;
  tipo_cuenta: TipoCuenta;
  contrasena?: string;
  correo_institucional?: string;
};
type IdParams = { id: string };
type EstadoCuenta = { estado: 'activa' | 'bloqueada' };
type ResetClave = { contrasena?: string };
const idSchema={type:'string',pattern:'^[1-9][0-9]{0,17}$'};
const paramsSchema={type:'object',required:['id'],additionalProperties:false,properties:{id:idSchema}};

function errorBase(
  reply: FastifyReply, code: number, error: string, motivo: string, solucion: string
) {
  return reply.code(code).send({error,motivo,solucion});
}
function contrasenaTemporal(): string {
  return randomBytes(24).toString('base64url');
}
function validarContrasena(valor: string) {
  return valor.length >= 12 && valor.length <= 128 && !/[\u0000-\u001f\u007f]/.test(valor);
}
async function hashContrasena(plain: string) {
  return argon2.hash(plain,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
}
async function soloSuperadministrador(
  request:FastifyRequest,reply:FastifyReply
) {
  const u=await autorizar(request,reply,'ADMIN_GENERAL');
  if(!u) return null;
  if(!u.es_superadministrador){
    reply.code(403).send({error:'Solo el superadministrador puede gestionar cuentas.'});
    return null;
  }
  return u;
}

export function registrarRutasUsuarios(app:FastifyInstance) {
  // El propietario puede usar su carnet como login sin crear un segundo
  // superadministrador ni trasladar privilegios a otra cuenta.
  app.patch<{Body:{nuevo_usuario:string;nombre_mostrado:string;contrasena_actual:string}}>(
    '/api/admin/usuarios/mi-identidad',{
      config:{rateLimit:{max:5,timeWindow:'1 minute'}},
      schema:{body:{type:'object',additionalProperties:false,
        required:['nuevo_usuario','nombre_mostrado','contrasena_actual'],
        properties:{
          nuevo_usuario:{type:'string',minLength:6,maxLength:20,pattern:'^[A-Za-z]{2}[0-9]{5}$'},
          nombre_mostrado:{type:'string',minLength:3,maxLength:120},
          contrasena_actual:{type:'string',minLength:1,maxLength:128}
        }}}
    },async(request,reply)=>{
      reply.header('Cache-Control','no-store');
      const admin=await soloSuperadministrador(request,reply);
      if(!admin)return reply;
      const nuevo=request.body.nuevo_usuario.trim().toUpperCase();
      const nombre=request.body.nombre_mostrado.trim();
      if(!/^[A-Z]{2}[0-9]{5}$/.test(nuevo)||nombre.length<3)
        return reply.code(400).send({error:'Verifica el carnet y el nombre completo.'});
      const {rows}=await pool.query<{contrasena_hash:string}>(
        'SELECT contrasena_hash FROM sigpmat.usuarios WHERE id_usuario=$1::bigint AND es_superadministrador=TRUE',
        [admin.id_usuario]);
      const vieja=rows[0]?.contrasena_hash;
      if(!vieja)return reply.code(403).send({error:'Cuenta de superadministrador no disponible.'});
      if(!await argon2.verify(vieja,request.body.contrasena_actual).catch(()=>false))
        return reply.code(401).send({error:'Contraseña actual incorrecta.'});
      try {
        const result=await pool.query(
          `UPDATE sigpmat.usuarios SET nombre_usuario=$2,nombre_mostrado=$3,
             tipo_cuenta='integrante',sesion_version=sesion_version+1
            WHERE id_usuario=$1::bigint AND es_superadministrador=TRUE
              AND contrasena_hash=$4 RETURNING id_usuario`,
          [admin.id_usuario,nuevo,nombre,vieja]);
        if(!result.rowCount)return reply.code(409).send({error:'La cuenta cambió durante la operación.'});
        return {actualizado:true,nuevo_usuario:nuevo,mensaje:'Identidad actualizada. Inicia sesión utilizando tu carnet.'};
      }catch(e){
        if((e as {code?:string}).code==='23505')return reply.code(409).send({error:'Ese carnet ya pertenece a otra cuenta.'});
        request.log.error({err:e},'Error de cambio de carnet');
        return reply.code(500).send({error:'No se pudo actualizar tu carnet.'});
      }
    }
  );

  app.get('/api/admin/usuarios',async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    const u=await soloSuperadministrador(request,reply);
    if(!u)return reply;
    const {rows}=await pool.query(
      `SELECT u.id_usuario::text,u.nombre_usuario,u.nombre_mostrado,
              u.tipo_cuenta,u.estado,u.es_superadministrador,
              u.debe_cambiar_contrasena,u.ultimo_acceso_at,u.creado_at,
              COALESCE(array_agg(r.codigo ORDER BY r.codigo)
                FILTER (WHERE r.codigo IS NOT NULL),'{}'::varchar[]) AS roles
         FROM sigpmat.usuarios u
         LEFT JOIN sigpmat.usuario_roles ur ON ur.id_usuario=u.id_usuario
         LEFT JOIN sigpmat.roles r ON r.id_rol=ur.id_rol AND r.activo
        GROUP BY u.id_usuario
        ORDER BY u.es_superadministrador DESC, u.creado_at, u.id_usuario
        LIMIT 100`
    );
    return {usuarios:rows};
  });

  app.post<{Body:CuentaNueva}>('/api/admin/usuarios',{
    config:{rateLimit:{max:8,timeWindow:'1 minute'}},
    schema:{body:{
      type:'object',additionalProperties:false,
      required:['nombre_usuario','nombre_mostrado','tipo_cuenta'],
      properties:{
        nombre_usuario:{type:'string',minLength:3,maxLength:50,pattern:'^[A-Za-z0-9._-]+$'},
        nombre_mostrado:{type:'string',minLength:3,maxLength:120},
        tipo_cuenta:{type:'string',enum:['integrante','docente']},
        contrasena:{type:'string',minLength:12,maxLength:128},
        correo_institucional:{type:'string',minLength:5,maxLength:150}
      }
    }}
  },async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    const admin=await soloSuperadministrador(request,reply);
    if(!admin)return reply;
    const b=request.body;
    const usuario=b.nombre_usuario.trim().toUpperCase();
    const nombre=b.nombre_mostrado.trim();
    if(nombre.length<3){
      return reply.code(400).send({error:'El nombre completo debe tener al menos tres caracteres.'});
    }
    if(b.tipo_cuenta==='integrante' && !/^[A-Z]{2}[0-9]{5}$/.test(usuario)){
      return errorBase(reply,400,'El carnet debe tener dos letras y cinco números.',
        'Debe contener las iniciales de los apellidos seguidas de cinco cifras.',
        'Introduce el carnet tal como aparece en los documentos de la universidad; ejemplo ilustrativo AB12345.');
    }
    const correo=b.correo_institucional?.trim().toLowerCase()
      || (usuario.toLowerCase()+'@sigpmat.invalid');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length>150){
      return reply.code(400).send({error:'Indica un correo válido o déjalo vacío para utilizar un identificador interno.'});
    }
    const generado=!b.contrasena;
    const clave=b.contrasena??contrasenaTemporal();
    if(!validarContrasena(clave)){
      return reply.code(400).send({error:'Usa una contraseña de 12 a 128 caracteres, sin caracteres de control.'});
    }
    const hash=await hashContrasena(clave);
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      // Cuenta administrativa operativa sin posibilidad de crear otros superadmins.
      const role=await client.query<{id_rol:string}>(
        "SELECT id_rol::text FROM sigpmat.roles WHERE codigo='ADMIN_GENERAL' AND activo=TRUE");
      if(!role.rows[0])throw new Error('No está habilitado ADMIN_GENERAL');
      const creacion=await client.query<{id_usuario:string}>(
        `INSERT INTO sigpmat.usuarios
          (nombre_usuario,correo_institucional,contrasena_hash,
           nombre_mostrado,tipo_cuenta,estado,es_superadministrador,
           debe_cambiar_contrasena,sesion_version)
         VALUES ($1,$2,$3,$4,$5,'activa',FALSE,TRUE,0)
         RETURNING id_usuario::text`,
        [usuario,correo,hash,nombre,b.tipo_cuenta]);
      const id=creacion.rows[0].id_usuario;
      await client.query(
        `INSERT INTO sigpmat.usuario_roles(id_usuario,id_rol,asignado_por)
         VALUES ($1::bigint,$2::bigint,$3::bigint)`,
        [id,role.rows[0].id_rol,admin.id_usuario]
      );
      await client.query('COMMIT');
      return reply.code(201).send({
        usuario:{
          id_usuario:id,nombre_usuario:usuario,nombre_mostrado:nombre,
          tipo_cuenta:b.tipo_cuenta,estado:'activa',roles:['ADMIN_GENERAL'],
          es_superadministrador:false,debe_cambiar_contrasena:true
        },
        ...(generado?{contrasena_temporal:clave}:{}),
        aviso:'La persona debe cambiar la contraseña en su primer inicio de sesión.'
      });
    }catch(e){
      await client.query('ROLLBACK').catch(()=>{});
      if((e as {code?:string}).code==='23505')
        return errorBase(reply,409,'La cuenta ya existe.',
          'El carnet, nombre de usuario o correo ya está registrado.',
          'Busca la cuenta existente o utiliza otro identificador.');
      request.log.error({err:e},'Error al crear cuenta');
      return reply.code(500).send({error:'No se pudo crear la cuenta.'});
    }finally{client.release();}
  });

  app.patch<{Params:IdParams;Body:EstadoCuenta}>('/api/admin/usuarios/:id/estado',{
    schema:{params:paramsSchema,body:{type:'object',additionalProperties:false,
      required:['estado'],properties:{estado:{type:'string',enum:['activa','bloqueada']}}}}
  },async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    const admin=await soloSuperadministrador(request,reply);
    if(!admin)return reply;
    if(request.params.id===admin.id_usuario){
      return reply.code(409).send({error:'No puedes bloquear tu propia cuenta de superadministrador.'});
    }
    const row=await pool.query<{id_usuario:string;es_superadministrador:boolean}>(
      'SELECT id_usuario::text,es_superadministrador FROM sigpmat.usuarios WHERE id_usuario=$1::bigint',
      [request.params.id]);
    if(!row.rows[0])return reply.code(404).send({error:'Usuario no encontrado.'});
    if(row.rows[0].es_superadministrador)
      return reply.code(403).send({error:'No se permite cambiar el estado de otro superadministrador.'});
    const result=await pool.query(
      `UPDATE sigpmat.usuarios SET estado=$2,
         sesion_version=sesion_version+1 WHERE id_usuario=$1::bigint
         AND es_superadministrador=FALSE RETURNING id_usuario`,
      [request.params.id,request.body.estado]);
    if(!result.rowCount)return reply.code(409).send({error:'La cuenta cambió durante la operación.'});
    return {actualizado:true};
  });

  app.post<{Params:IdParams;Body:ResetClave}>('/api/admin/usuarios/:id/restablecer',{
    config:{rateLimit:{max:6,timeWindow:'1 minute'}},
    schema:{params:paramsSchema,body:{type:'object',additionalProperties:false,
      properties:{contrasena:{type:'string',minLength:12,maxLength:128}}}}
  },async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    const admin=await soloSuperadministrador(request,reply);
    if(!admin)return reply;
    if(admin.id_usuario===request.params.id)
      return reply.code(409).send({error:'Para tu cuenta, utiliza Cambiar mi contraseña.'});
    const temporal=!request.body.contrasena;
    const clave=request.body.contrasena??contrasenaTemporal();
    if(!validarContrasena(clave))
      return reply.code(400).send({error:'La contraseña debe tener entre 12 y 128 caracteres.'});
    const hash=await hashContrasena(clave);
    const result=await pool.query(
      `UPDATE sigpmat.usuarios SET contrasena_hash=$2,
         debe_cambiar_contrasena=TRUE,sesion_version=sesion_version+1
         WHERE id_usuario=$1::bigint AND es_superadministrador=FALSE
         RETURNING id_usuario`,
      [request.params.id,hash]);
    if(!result.rowCount)return reply.code(404).send({error:'Cuenta inexistente o protegida.'});
    return {actualizado:true,...(temporal?{contrasena_temporal:clave}:{})};
  });
}
