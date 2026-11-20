import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import { autorizar } from '../auth/routes.js';

type Cuenta = { id_usuario: string; roles: string[] };
type Params = { id: string };
type NuevoTurno = {
  id_departamento: string; id_cargo: string; tipo_turno: string;
  inicio_at: string; fin_at: string; cupos_requeridos: number;
  id_especialidad?: string | null; prioridad?: string;
};
type NuevaAsignacion = { id_requerimiento: string; id_empleado: string };

const idSchema = { type: 'string', pattern: '^[1-9][0-9]{0,18}$', maxLength: 19 };
const paramsSchema = {
  type: 'object', required: ['id'], additionalProperties: false,
  properties: { id: idSchema }
};
const idValido = (s: string) =>
  /^[1-9][0-9]{0,18}$/.test(s) && BigInt(s) <= 9223372036854775807n;

function fechaHoraValida(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(s)) return null;
  const fecha = new Date(s);
  return Number.isFinite(fecha.getTime()) ? fecha : null;
}

function respuestaError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === '23514' || e?.code === '23505') {
    return reply.code(409).send({
      error: e.message?.startsWith('SIGPMAT:')
        ? e.message.replace(/^SIGPMAT: /, '')
        : 'Operación incompatible con las reglas del sistema'
    });
  }
  if (e?.code === '23503') return reply.code(422).send({ error: 'Registro relacionado inexistente' });
  request.log.error({ err: error }, 'Error en el módulo de turnos');
  return reply.code(500).send({ error: 'No se pudo completar la operación' });
}

async function rollback(client: PoolClient) {
  try { await client.query('ROLLBACK'); } catch { /* La transacción pudo cerrarse */ }
}

async function cuentaOperativa(request: FastifyRequest, reply: FastifyReply) {
  const usuario = await autorizar(request, reply);
  if (!usuario) return null;
  if (!usuario.roles.includes('ADMIN_GENERAL') &&
      !usuario.roles.includes('JEFE_AREA') &&
      !usuario.roles.includes('VISITANTE_LECTURA')) {
    reply.code(403).send({ error: 'Este rol no tiene acceso a turnos' });
    return null;
  }
  return usuario;
}

async function areaAutorizada(usuario: Cuenta, idDepartamento: string) {
  if (usuario.roles.includes('ADMIN_GENERAL')) return true;
  if (!usuario.roles.includes('JEFE_AREA')) return false;
  const { rows } = await pool.query<{ autorizado: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM sigpmat.usuarios u " +
    "JOIN sigpmat.empleados e ON e.id_empleado=u.id_empleado " +
    "JOIN sigpmat.empleado_departamento ed ON ed.id_empleado=e.id_empleado " +
    "JOIN sigpmat.departamentos d ON d.id_departamento=ed.id_departamento " +
    "WHERE u.id_usuario=$1::bigint AND ed.id_departamento=$2::bigint " +
    "AND e.estado_vinculo='activo' AND d.activo=TRUE AND ed.es_jefe=TRUE " +
    "AND ed.fecha_inicio<=CURRENT_DATE AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=CURRENT_DATE)) AS autorizado",
    [usuario.id_usuario, idDepartamento]
  );
  return rows[0]?.autorizado === true;
}

export function registrarRutasTurnos(app: FastifyInstance): void {
  app.get('/api/cargos', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!await cuentaOperativa(request, reply)) return reply;
    const { rows } = await pool.query(
      "SELECT id_cargo::text, nombre, categoria FROM sigpmat.cargos WHERE activo=TRUE ORDER BY nombre LIMIT 100"
    );
    return { cargos: rows };
  });

  // La búsqueda se ejecuta en PostgreSQL ANTES de LIMIT 100 para
  // encontrar a profesionales asignados también fuera de la primera página.
  // Siempre se filtra por departamentos permitidos al rol autenticado.
  app.get<{ Querystring: { q?: string } }>('/api/turnos', {
    schema: {
      querystring: {
        type: 'object', additionalProperties: false,
        properties: { q: { type: 'string', maxLength: 80 } }
      }
    }
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const usuario = await cuentaOperativa(request, reply);
    if (!usuario) return reply;
    const busqueda = (request.query.q || '').trim();
    const sql = `
      SELECT t.id_turno::text, t.id_departamento::text, d.nombre AS departamento,
             t.tipo_turno, t.inicio_at, t.fin_at, t.estado,
             COALESCE((SELECT SUM(r.cupos_requeridos)
                       FROM sigpmat.requerimientos_turno r WHERE r.id_turno=t.id_turno),0)::integer AS cupos_requeridos,
             COALESCE((SELECT COUNT(*)
                       FROM sigpmat.asignaciones_turno a
                       JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento=a.id_requerimiento
                       WHERE r.id_turno=t.id_turno AND a.estado IN ('asignada','confirmada')),0)::integer AS cupos_ocupados,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id_empleado', e.id_empleado::text,
                 'codigo_empleado', e.codigo_empleado,
                 'nombre_completo', concat_ws(' ', e.nombres, e.apellidos)
               ) ORDER BY e.apellidos, e.nombres)
               FROM sigpmat.asignaciones_turno a
               JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento=a.id_requerimiento
               JOIN sigpmat.empleados e ON e.id_empleado=a.id_empleado
               WHERE r.id_turno=t.id_turno AND a.estado IN ('asignada','confirmada')
             ), '[]'::json) AS personal_asignado
      FROM sigpmat.turnos t
      JOIN sigpmat.departamentos d ON d.id_departamento=t.id_departamento
      WHERE (
        $1::boolean OR EXISTS (
          SELECT 1 FROM sigpmat.usuarios u
          JOIN sigpmat.empleados e ON e.id_empleado=u.id_empleado
          JOIN sigpmat.empleado_departamento ed ON ed.id_empleado=e.id_empleado
          WHERE u.id_usuario=$2::bigint
            AND e.estado_vinculo='activo' AND ed.id_departamento=t.id_departamento
            AND ed.es_jefe=TRUE AND ed.fecha_inicio<=CURRENT_DATE
            AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=CURRENT_DATE)
        )
      )
      AND (
        $3::text='' OR
        ($3 ~ '^[0-9]+$' AND t.id_turno::text = $3) OR
        ($3 !~ '^[0-9]+$' AND (
          strpos(lower(d.nombre),lower($3)) > 0 OR
        strpos(lower(d.codigo),lower($3)) > 0 OR
        strpos(lower(t.tipo_turno),lower($3)) > 0 OR
        strpos(lower(t.estado),lower($3)) > 0 OR
        strpos(to_char(t.inicio_at AT TIME ZONE 'America/El_Salvador','YYYY-MM-DD'),$3) > 0 OR
        EXISTS (
          SELECT 1 FROM sigpmat.asignaciones_turno a
          JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento=a.id_requerimiento
          JOIN sigpmat.empleados e ON e.id_empleado=a.id_empleado
          JOIN sigpmat.cargos c ON c.id_cargo=e.id_cargo
          WHERE r.id_turno=t.id_turno AND a.estado IN ('asignada','confirmada')
            AND (
              strpos(lower(e.nombres || ' ' || e.apellidos),lower($3)) > 0 OR
              strpos(lower(e.apellidos || ' ' || e.nombres),lower($3)) > 0 OR
              strpos(lower(e.codigo_empleado),lower($3)) > 0 OR
              strpos(lower(c.nombre),lower($3)) > 0
            )
        )
        ))
      )
      ORDER BY t.inicio_at DESC LIMIT 100
    `;
    const { rows } = await pool.query(sql, [
      usuario.roles.includes('ADMIN_GENERAL') || usuario.roles.includes('VISITANTE_LECTURA'), usuario.id_usuario, busqueda
    ]);
    return { turnos: rows, limite: 100, busqueda };
  });

  app.get<{ Params: Params }>('/api/turnos/:id', { schema: { params: paramsSchema } },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const usuario = await cuentaOperativa(request, reply);
      if (!usuario) return reply;
      const { id } = request.params;
      if (!idValido(id)) return reply.code(400).send({ error: 'Identificador inválido' });
      const turno = await pool.query(
        "SELECT t.id_turno::text, t.id_departamento::text, d.nombre AS departamento, " +
        "t.tipo_turno, t.inicio_at, t.fin_at, t.estado FROM sigpmat.turnos t " +
        "JOIN sigpmat.departamentos d ON d.id_departamento=t.id_departamento WHERE t.id_turno=$1::bigint",
        [id]
      );
      if (!turno.rows[0] || (!usuario.roles.includes('VISITANTE_LECTURA') &&
          !await areaAutorizada(usuario, turno.rows[0].id_departamento))) {
        return reply.code(404).send({ error: 'Turno no encontrado' });
      }
      const requerimientos = await pool.query(
        "SELECT r.id_requerimiento::text, r.id_cargo::text, c.nombre AS cargo, r.cupos_requeridos, r.prioridad, " +
        "r.id_especialidad::text, s.nombre AS especialidad, " +
        "(SELECT COUNT(*)::integer FROM sigpmat.asignaciones_turno a WHERE a.id_requerimiento=r.id_requerimiento " +
        "AND a.estado IN ('asignada','confirmada')) AS cupos_ocupados " +
        "FROM sigpmat.requerimientos_turno r JOIN sigpmat.cargos c ON c.id_cargo=r.id_cargo " +
        "LEFT JOIN sigpmat.especialidades s ON s.id_especialidad=r.id_especialidad " +
        "WHERE r.id_turno=$1::bigint ORDER BY r.id_requerimiento", [id]
      );
      const asignaciones = await pool.query(
        "SELECT a.id_asignacion::text,a.id_requerimiento::text,a.id_empleado::text, " +
        "e.codigo_empleado,e.nombres,e.apellidos,a.estado " +
        "FROM sigpmat.asignaciones_turno a " +
        "JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento=a.id_requerimiento " +
        "JOIN sigpmat.empleados e ON e.id_empleado=a.id_empleado " +
        "WHERE r.id_turno=$1::bigint AND a.estado IN ('asignada','confirmada') " +
        "ORDER BY a.asignado_at", [id]
      );
      return {
        turno: turno.rows[0],
        requerimientos: requerimientos.rows,
        asignaciones: asignaciones.rows
      };
    }
  );

  app.post<{ Body: NuevoTurno }>('/api/turnos', {
    schema: { body: {
      type: 'object', additionalProperties: false,
      required: ['id_departamento', 'id_cargo', 'tipo_turno', 'inicio_at', 'fin_at', 'cupos_requeridos'],
      properties: {
        id_departamento: idSchema, id_cargo: idSchema,
        id_especialidad: { anyOf: [idSchema, { type: 'null' }] },
        tipo_turno: { type: 'string', enum: ['diurno','nocturno','mixto','emergencia'] },
        inicio_at: { type: 'string', minLength: 20, maxLength: 35 },
        fin_at: { type: 'string', minLength: 20, maxLength: 35 },
        cupos_requeridos: { type: 'integer', minimum: 1, maximum: 200 },
        prioridad: { type: 'string', enum: ['normal','alta','critica'] }
      }
    }}
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const usuario = await cuentaOperativa(request, reply);
    if (!usuario) return reply;
    const b = request.body;
    const ids = [b.id_departamento, b.id_cargo, b.id_especialidad].filter(
      (value): value is string => typeof value === 'string'
    );
    if (!ids.every(idValido)) return reply.code(400).send({ error: 'Identificador inválido' });
    if (!await areaAutorizada(usuario,b.id_departamento)) {
      return reply.code(403).send({ error: 'Departamento no autorizado' });
    }
    const inicio = fechaHoraValida(b.inicio_at), fin = fechaHoraValida(b.fin_at);
    if (!inicio || !fin || fin <= inicio || inicio <= new Date()) {
      return reply.code(422).send({ error: 'El turno debe comenzar en el futuro y terminar después del inicio' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const departamento = await client.query(
        "SELECT 1 FROM sigpmat.departamentos WHERE id_departamento=$1::bigint AND activo=TRUE",
        [b.id_departamento]
      );
      const cargo = await client.query(
        "SELECT 1 FROM sigpmat.cargos WHERE id_cargo=$1::bigint AND activo=TRUE",
        [b.id_cargo]
      );
      if (!departamento.rowCount || !cargo.rowCount) {
        await rollback(client);
        return reply.code(422).send({ error: 'Departamento o cargo no válido' });
      }
      if (b.id_especialidad) {
        const esp = await client.query(
          "SELECT 1 FROM sigpmat.especialidades WHERE id_especialidad=$1::bigint AND activo=TRUE",
          [b.id_especialidad]
        );
        if (!esp.rowCount) {
          await rollback(client);
          return reply.code(422).send({ error: 'Especialidad no válida' });
        }
      }
      const turno = await client.query<{ id_turno: string }>(
        "INSERT INTO sigpmat.turnos (id_departamento,tipo_turno,inicio_at,fin_at,estado,creado_por) " +
        "VALUES ($1::bigint,$2,$3::timestamptz,$4::timestamptz,'abierto',$5::bigint) RETURNING id_turno::text",
        [b.id_departamento,b.tipo_turno,inicio.toISOString(),fin.toISOString(),usuario.id_usuario]
      );
      const req = await client.query<{ id_requerimiento: string }>(
        "INSERT INTO sigpmat.requerimientos_turno (id_turno,id_cargo,id_especialidad,cupos_requeridos,prioridad) " +
        "VALUES ($1::bigint,$2::bigint,$3::bigint,$4,$5) RETURNING id_requerimiento::text",
        [turno.rows[0].id_turno,b.id_cargo,b.id_especialidad??null,b.cupos_requeridos,b.prioridad??'normal']
      );
      await client.query('COMMIT');
      return reply.code(201).send({ turno: {
        id_turno:turno.rows[0].id_turno,id_requerimiento:req.rows[0].id_requerimiento
      }});
    } catch (e) { await rollback(client); return respuestaError(request, reply, e); }
    finally { client.release(); }
  });

  app.post<{ Params: Params; Body: NuevaAsignacion }>('/api/turnos/:id/asignaciones', {
    schema: {
      params: paramsSchema,
      body: {
        type: 'object', additionalProperties: false,
        required: ['id_requerimiento','id_empleado'],
        properties: { id_requerimiento:idSchema, id_empleado:idSchema }
      }
    }
  }, async (request, reply) => {
    reply.header('Cache-Control','no-store');
    const usuario = await cuentaOperativa(request,reply);
    if (!usuario) return reply;
    const { id } = request.params;
    const { id_requerimiento,id_empleado }=request.body;
    if (![id,id_requerimiento,id_empleado].every(idValido)) {
      return reply.code(400).send({error:'Identificador inválido'});
    }
    const { rows }=await pool.query<{
      id_departamento:string; estado:string; inicio_at:string; fin_at:string;
    }>(
      "SELECT t.id_departamento::text,t.estado,t.inicio_at,t.fin_at " +
      "FROM sigpmat.requerimientos_turno r " +
      "JOIN sigpmat.turnos t ON t.id_turno=r.id_turno " +
      "WHERE t.id_turno=$1::bigint AND r.id_requerimiento=$2::bigint",
      [id,id_requerimiento]
    );
    const turno=rows[0];
    if (!turno || !await areaAutorizada(usuario,turno.id_departamento)) {
      return reply.code(404).send({error:'Turno no encontrado'});
    }
    if (turno.estado!=='abierto') return reply.code(409).send({error:'El turno no está abierto'});
    if (new Date(turno.inicio_at)<=new Date()) {
      return reply.code(409).send({error:'El turno ya comenzó'});
    }
    const { rows: vinculos }=await pool.query<{vigente:boolean}>(
      "SELECT EXISTS(SELECT 1 FROM sigpmat.empleados e " +
      "JOIN sigpmat.empleado_departamento ed ON ed.id_empleado=e.id_empleado " +
      "WHERE e.id_empleado=$1::bigint AND e.estado_vinculo='activo' AND ed.id_departamento=$2::bigint " +
      "AND ed.fecha_inicio<=($3::timestamptz AT TIME ZONE 'America/El_Salvador')::date " +
      "AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=(($4::timestamptz - interval '1 microsecond') AT TIME ZONE 'America/El_Salvador')::date)) AS vigente",
      [id_empleado,turno.id_departamento,turno.inicio_at,turno.fin_at]
    );
    if (!vinculos[0]?.vigente) {
      return reply.code(409).send({error:'El empleado no tiene adscripción vigente en este departamento durante el turno'});
    }
    try {
      const result=await pool.query<{id_asignacion:string}>(
        "INSERT INTO sigpmat.asignaciones_turno (id_requerimiento,id_empleado,origen,estado,asignado_por) " +
        "VALUES ($1::bigint,$2::bigint,'manual','asignada',$3::bigint) RETURNING id_asignacion::text",
        [id_requerimiento,id_empleado,usuario.id_usuario]
      );
      return reply.code(201).send({asignacion:{id_asignacion:result.rows[0].id_asignacion}});
    } catch (e) { return respuestaError(request,reply,e); }
  });

  app.patch<{ Params: Params }>('/api/asignaciones/:id/cancelar', {
    schema: { params: paramsSchema }
  }, async (request,reply) => {
    reply.header('Cache-Control','no-store');
    const usuario=await cuentaOperativa(request,reply); if(!usuario) return reply;
    const id=request.params.id;
    if(!idValido(id)) return reply.code(400).send({error:'Identificador inválido'});
    const {rows}=await pool.query<{id_departamento:string;estado:string}>(
      "SELECT t.id_departamento::text,a.estado FROM sigpmat.asignaciones_turno a " +
      "JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento=a.id_requerimiento " +
      "JOIN sigpmat.turnos t ON t.id_turno=r.id_turno WHERE a.id_asignacion=$1::bigint",[id]
    );
    if(!rows[0] || !await areaAutorizada(usuario,rows[0].id_departamento)) {
      return reply.code(404).send({error:'Asignación no encontrada'});
    }
    if(rows[0].estado==='cancelada') return reply.code(409).send({error:'La asignación ya está cancelada'});
    try{
      const result=await pool.query(
        "UPDATE sigpmat.asignaciones_turno SET estado='cancelada' WHERE id_asignacion=$1::bigint " +
        "RETURNING id_asignacion::text",[id]
      );
      return {asignacion:result.rows[0]};
    }catch(e){return respuestaError(request,reply,e);}
  });

  app.patch<{ Params: Params }>('/api/turnos/:id/cancelar', {
    schema: { params: paramsSchema }
  }, async (request,reply) => {
    reply.header('Cache-Control','no-store');
    const usuario=await cuentaOperativa(request,reply); if(!usuario) return reply;
    const id=request.params.id;
    if(!idValido(id)) return reply.code(400).send({error:'Identificador inválido'});
    const {rows}=await pool.query<{id_departamento:string;estado:string}>(
      "SELECT id_departamento::text,estado FROM sigpmat.turnos WHERE id_turno=$1::bigint",[id]
    );
    if(!rows[0] || !await areaAutorizada(usuario,rows[0].id_departamento)) {
      return reply.code(404).send({error:'Turno no encontrado'});
    }
    if(rows[0].estado==='cancelado') return reply.code(409).send({error:'Turno ya cancelado'});
    try{
      const result=await pool.query(
        "UPDATE sigpmat.turnos SET estado='cancelado' WHERE id_turno=$1::bigint " +
        "RETURNING id_turno::text",[id]
      );
      return {turno:result.rows[0]};
    }catch(e){return respuestaError(request,reply,e);}
  });
}
