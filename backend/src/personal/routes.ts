import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import { autorizar } from '../auth/routes.js';

// SIGPMAT v0.5: operaciones administrativas y consultas sujetas a RBAC.
// NO se exponen DUI, correos ni telefonos. Solo registros ficticios en smoke tests.
const BIGINT_MAX = 9223372036854775807n;
const BIGINT_PATTERN = '^[1-9][0-9]{0,18}$';
const idValido = (s: string): boolean =>
  /^[1-9][0-9]{0,18}$/.test(s) && BigInt(s) <= BIGINT_MAX;

type Params = { id: string };
type PatchEmpleado = {
  nombres?: string; apellidos?: string;
  estado_vinculo?: 'activo' | 'suspendido' | 'inactivo';
  id_cargo?: string;
};
type Acreditacion = {
  id_especialidad: string;
  fecha_acreditacion: string;
  vigente_desde: string;
  vigente_hasta?: string;
  es_principal?: boolean;
};
type Traslado = { id_departamento: string; fecha_efectiva: string };

function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [a, m, d] = fecha.split('-').map(Number);
  const tmp = new Date(0);
  tmp.setUTCFullYear(a, m - 1, d);
  tmp.setUTCHours(0, 0, 0, 0);
  return tmp.getUTCFullYear() === a && tmp.getUTCMonth() + 1 === m && tmp.getUTCDate() === d;
}

const paramSchema = {
  type: 'object', required: ['id'], additionalProperties: false,
  properties: { id: { type: 'string', pattern: BIGINT_PATTERN, maxLength: 19 } }
};
const formatoFecha = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };

function errorDb(reply: FastifyReply, request: FastifyRequest, error: unknown, contexto: string) {
  const e = error as { code?: string } | null;
  if (e?.code === '23514') {
    return reply.code(409).send({ error: 'La operacion incumple una regla operativa o de integridad' });
  }
  if (e?.code === '23505') {
    return reply.code(409).send({ error: 'Registro duplicado' });
  }
  if (e?.code === '23503') {
    return reply.code(422).send({ error: 'Referencia de catalogo no valida' });
  }
  request.log.error({ err: error }, contexto);
  return reply.code(500).send({ error: 'No se pudo completar la operacion' });
}

async function rollback(client: PoolClient) {
  try { await client.query('ROLLBACK'); } catch { /* conexion posiblemente cerrada */ }
}

async function comprobarVisualizacion(
  request: FastifyRequest,
  reply: FastifyReply,
  idEmpleado: string
): Promise<boolean | null> {
  const usuario = await autorizar(request, reply);
  if (!usuario) return null;
  const admin = usuario.roles.includes('ADMIN_GENERAL');
  if (!admin && !usuario.roles.includes('JEFE_AREA')) {
    reply.code(403).send({ error: 'Acceso no autorizado' });
    return null;
  }
  if (admin) return true;
  const resultado = await pool.query<{ autorizado: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM sigpmat.empleados e
       JOIN sigpmat.empleado_departamento ed ON ed.id_empleado = e.id_empleado
       JOIN sigpmat.departamentos d ON d.id_departamento = ed.id_departamento
       JOIN sigpmat.empleado_departamento jefe_ed
         ON jefe_ed.id_departamento = ed.id_departamento
       JOIN sigpmat.usuarios u ON u.id_empleado = jefe_ed.id_empleado
       JOIN sigpmat.empleados j ON j.id_empleado = u.id_empleado
       WHERE e.id_empleado = $1::bigint AND u.id_usuario = $2::bigint
         AND e.estado_vinculo = 'activo' AND j.estado_vinculo = 'activo'
         AND d.activo = TRUE
         AND ed.fecha_inicio <= CURRENT_DATE
         AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= CURRENT_DATE)
         AND jefe_ed.es_jefe = TRUE
         AND jefe_ed.fecha_inicio <= CURRENT_DATE
         AND (jefe_ed.fecha_fin IS NULL OR jefe_ed.fecha_fin >= CURRENT_DATE)
     ) AS autorizado`,
    [idEmpleado, usuario.id_usuario]
  );
  if (resultado.rows[0]?.autorizado !== true) {
    reply.code(404).send({ error: 'Empleado no encontrado' });
    return null;
  }
  return true;
}

export function registrarRutasPersonalV05(app: FastifyInstance): void {
  app.patch<{ Params: Params; Body: PatchEmpleado }>(
    '/api/empleados/:id',
    { schema: {
      params: paramSchema,
      body: {
        type: 'object', additionalProperties: false, minProperties: 1,
        properties: {
          nombres: { type: 'string', minLength: 1, maxLength: 90 },
          apellidos: { type: 'string', minLength: 1, maxLength: 90 },
          estado_vinculo: { type: 'string', enum: ['activo','suspendido','inactivo'] },
          id_cargo: { type: 'string', pattern: BIGINT_PATTERN, maxLength: 19 }
        }
      }
    } },
    async (request, reply) => {
      reply.header('Cache-Control','no-store');
      const usuario = await autorizar(request, reply, 'ADMIN_GENERAL');
      if (!usuario) return reply;
      const { id } = request.params;
      if (!idValido(id) || (request.body.id_cargo && !idValido(request.body.id_cargo))) {
        return reply.code(400).send({ error: 'Identificador invalido' });
      }
      const { nombres, apellidos, id_cargo, estado_vinculo } = request.body;
      if (nombres !== undefined && !nombres.trim() || apellidos !== undefined && !apellidos.trim()) {
        return reply.code(400).send({ error: 'Nombres y apellidos no pueden estar vacios' });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const empleado = await client.query(
          `SELECT id_empleado FROM sigpmat.empleados WHERE id_empleado = $1::bigint FOR UPDATE`, [id]
        );
        if (!empleado.rowCount) {
          await rollback(client);
          return reply.code(404).send({ error: 'Empleado no encontrado' });
        }
        if (id_cargo) {
          const cargo = await client.query(
            `SELECT 1 FROM sigpmat.cargos WHERE id_cargo=$1::bigint AND activo=TRUE`, [id_cargo]
          );
          if (!cargo.rowCount) {
            await rollback(client);
            return reply.code(422).send({ error: 'Cargo inexistente o inactivo' });
          }
        }
        const actualizado = await client.query<{
          id_empleado: string; codigo_empleado: string; nombres: string;
          apellidos: string; id_cargo: string; estado_vinculo: string;
        }>(
          `UPDATE sigpmat.empleados SET
             nombres = COALESCE($2::varchar, nombres),
             apellidos = COALESCE($3::varchar, apellidos),
             id_cargo = COALESCE($4::bigint, id_cargo),
             estado_vinculo = COALESCE($5::varchar, estado_vinculo)
           WHERE id_empleado=$1::bigint
           RETURNING id_empleado::text, codigo_empleado, nombres,
                     apellidos, id_cargo::text, estado_vinculo`,
          [id, nombres?.trim() ?? null, apellidos?.trim() ?? null,
            id_cargo ?? null, estado_vinculo ?? null]
        );
        await client.query('COMMIT');
        return { empleado: actualizado.rows[0] };
      } catch (e) {
        await rollback(client);
        return errorDb(reply, request, e, 'Error al actualizar empleado');
      } finally { client.release(); }
    }
  );

  app.get('/api/especialidades', async (request, reply) => {
    reply.header('Cache-Control','no-store');
    const usuario = await autorizar(request, reply);
    if (!usuario) return reply;
    if (!usuario.roles.some(r => r === 'ADMIN_GENERAL' || r === 'JEFE_AREA')) {
      return reply.code(403).send({ error: 'Acceso no autorizado' });
    }
    const { rows } = await pool.query(
      `SELECT id_especialidad::text, codigo, nombre
       FROM sigpmat.especialidades WHERE activo=TRUE ORDER BY codigo LIMIT 100`
    );
    return { especialidades: rows, limite: 100 };
  });

  app.get<{ Params: Params }>(
    '/api/empleados/:id/especialidades',
    { schema: { params: paramSchema } },
    async (request, reply) => {
      reply.header('Cache-Control','no-store');
      const id = request.params.id;
      if (!idValido(id)) return reply.code(400).send({ error: 'Identificador invalido' });
      if (!await comprobarVisualizacion(request, reply, id)) return reply;
      const empleado = await pool.query('SELECT 1 FROM sigpmat.empleados WHERE id_empleado=$1::bigint', [id]);
      if (!empleado.rowCount) return reply.code(404).send({ error: 'Empleado no encontrado' });
      const { rows } = await pool.query(
        `SELECT ee.id_empleado_especialidad::text, s.codigo, s.nombre,
                to_char(ee.fecha_acreditacion, 'YYYY-MM-DD') AS fecha_acreditacion,
                to_char(ee.vigente_desde, 'YYYY-MM-DD') AS vigente_desde,
                to_char(ee.vigente_hasta, 'YYYY-MM-DD') AS vigente_hasta,
                ee.es_principal
           FROM sigpmat.empleado_especialidad ee
           JOIN sigpmat.especialidades s ON s.id_especialidad=ee.id_especialidad
          WHERE ee.id_empleado=$1::bigint
          ORDER BY ee.vigente_desde DESC, ee.id_empleado_especialidad DESC LIMIT 100`, [id]
      );
      return { especialidades: rows, limite: 100 };
    }
  );

  app.post<{ Params: Params; Body: Acreditacion }>(
    '/api/empleados/:id/especialidades',
    { schema: {
      params: paramSchema,
      body: {
        type: 'object', additionalProperties: false,
        required: ['id_especialidad','fecha_acreditacion','vigente_desde'],
        properties: {
          id_especialidad: { type: 'string', pattern: BIGINT_PATTERN, maxLength: 19 },
          fecha_acreditacion: formatoFecha,
          vigente_desde: formatoFecha,
          vigente_hasta: formatoFecha,
          es_principal: { type: 'boolean' }
        }
      }
    } },
    async (request, reply) => {
      reply.header('Cache-Control','no-store');
      if (!await autorizar(request, reply, 'ADMIN_GENERAL')) return reply;
      const id = request.params.id;
      const b = request.body;
      if (!idValido(id) || !idValido(b.id_especialidad)) return reply.code(400).send({ error: 'Identificador invalido' });
      if (![b.fecha_acreditacion, b.vigente_desde, b.vigente_hasta].filter((d): d is string => d !== undefined).every(fechaValida)) {
        return reply.code(400).send({ error: 'Fecha invalida' });
      }
      if (b.vigente_hasta && b.vigente_hasta < b.vigente_desde) {
        return reply.code(422).send({ error: 'La vigencia final no puede preceder el inicio' });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const empleado = await client.query(
          `SELECT 1 FROM sigpmat.empleados WHERE id_empleado=$1::bigint AND estado_vinculo='activo' FOR UPDATE`, [id]
        );
        const especialidad = await client.query(
          `SELECT 1 FROM sigpmat.especialidades WHERE id_especialidad=$1::bigint AND activo=TRUE`, [b.id_especialidad]
        );
        if (!empleado.rowCount || !especialidad.rowCount) {
          await rollback(client);
          return reply.code(422).send({ error: 'Empleado activo o especialidad no encontrados' });
        }
        const solape = await client.query(
          `SELECT 1 FROM sigpmat.empleado_especialidad ee
           WHERE ee.id_empleado=$1::bigint
             AND (ee.id_especialidad=$2::bigint OR ($5::boolean AND ee.es_principal=TRUE))
             AND (ee.vigente_hasta IS NULL OR ee.vigente_hasta >= $3::date)
             AND ($4::date IS NULL OR ee.vigente_desde <= $4::date)
           LIMIT 1`,
          [id, b.id_especialidad, b.vigente_desde, b.vigente_hasta ?? null, b.es_principal ?? false]
        );
        if (solape.rowCount) {
          await rollback(client);
          return reply.code(409).send({ error: 'Existe una acreditacion incompatible en el periodo' });
        }
        const nuevo = await client.query<{
          id_empleado_especialidad: string;
        }>(
          `INSERT INTO sigpmat.empleado_especialidad
             (id_empleado, id_especialidad, fecha_acreditacion, vigente_desde,
              vigente_hasta, es_principal)
           VALUES ($1::bigint, $2::bigint, $3::date, $4::date, $5::date, $6::boolean)
           RETURNING id_empleado_especialidad::text`,
          [id, b.id_especialidad, b.fecha_acreditacion, b.vigente_desde,
            b.vigente_hasta ?? null, b.es_principal ?? false]
        );
        await client.query('COMMIT');
        return reply.code(201).send({ acreditacion: nuevo.rows[0] });
      } catch (e) {
        await rollback(client);
        return errorDb(reply, request, e, 'Error al registrar acreditacion');
      } finally { client.release(); }
    }
  );

  app.post<{ Params: Params; Body: Traslado }>(
    '/api/empleados/:id/traslados',
    { schema: {
      params: paramSchema,
      body: {
        type: 'object', additionalProperties: false,
        required: ['id_departamento','fecha_efectiva'],
        properties: {
          id_departamento: { type: 'string', pattern: BIGINT_PATTERN, maxLength: 19 },
          fecha_efectiva: formatoFecha
        }
      }
    } },
    async (request, reply) => {
      reply.header('Cache-Control','no-store');
      if (!await autorizar(request, reply, 'ADMIN_GENERAL')) return reply;
      const id = request.params.id;
      const b = request.body;
      if (!idValido(id) || !idValido(b.id_departamento)) return reply.code(400).send({ error: 'Identificador invalido' });
      if (!fechaValida(b.fecha_efectiva)) return reply.code(400).send({ error: 'Fecha invalida' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query<{ futuro: boolean }>(
          `SELECT ($1::date > CURRENT_DATE) AS futuro`, [b.fecha_efectiva]
        );
        if (!rows[0]?.futuro) {
          await rollback(client);
          return reply.code(422).send({ error: 'El traslado debe programarse para una fecha futura' });
        }
        const empleado = await client.query(
          `SELECT 1 FROM sigpmat.empleados
           WHERE id_empleado=$1::bigint AND estado_vinculo='activo' FOR UPDATE`, [id]
        );
        if (!empleado.rowCount) {
          await rollback(client);
          return reply.code(422).send({ error: 'El empleado no existe o no esta activo' });
        }
        const d = await client.query(
          `SELECT 1 FROM sigpmat.departamentos
           WHERE id_departamento=$1::bigint AND activo=TRUE`, [b.id_departamento]
        );
        if (!d.rowCount) {
          await rollback(client);
          return reply.code(422).send({ error: 'Departamento inexistente o inactivo' });
        }
        const cuenta = await client.query(
          `SELECT 1 FROM sigpmat.usuarios WHERE id_empleado=$1::bigint LIMIT 1`, [id]
        );
        if (cuenta.rowCount) {
          await rollback(client);
          return reply.code(409).send({ error: 'No se traslada aqui personal con una cuenta vinculada' });
        }
        const previas = await client.query<{
          id_vinculo: string; id_departamento: string; es_jefe: boolean;
          fecha_inicio: string; fecha_fin: string | null;
        }>(
          `SELECT id_vinculo::text, id_departamento::text, es_jefe,
                  to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                  to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin
           FROM sigpmat.empleado_departamento
           WHERE id_empleado=$1::bigint
           ORDER BY fecha_inicio, id_vinculo FOR UPDATE`, [id]
        );
        if (!previas.rows.some(v => v.fecha_inicio <= b.fecha_efectiva &&
            (v.fecha_fin === null || v.fecha_fin >= b.fecha_efectiva))) {
          await rollback(client);
          return reply.code(409).send({ error: 'Sin adscripcion vigente en la fecha del traslado' });
        }
        if (previas.rows.some(v => v.es_jefe &&
            v.fecha_inicio <= b.fecha_efectiva &&
            (v.fecha_fin === null || v.fecha_fin >= b.fecha_efectiva))) {
          await rollback(client);
          return reply.code(409).send({ error: 'No se trasladan jefaturas con este procedimiento' });
        }
        if (previas.rows.some(v => v.fecha_inicio >= b.fecha_efectiva)) {
          await rollback(client);
          return reply.code(409).send({ error: 'Ya existe una adscripcion futura incompatible' });
        }
        if (previas.rows.some(v => v.id_departamento === b.id_departamento &&
            (v.fecha_fin === null || v.fecha_fin >= b.fecha_efectiva))) {
          await rollback(client);
          return reply.code(409).send({ error: 'Ya pertenece al departamento destino' });
        }
        // Evita romper coberturas asignadas en otra area despues del traslado.
        // TIMESTAMPTZ usa la zona local definida para el hospital de ensayo.
        const asignado = await client.query(
          `SELECT 1 FROM sigpmat.asignaciones_turno a
           JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento=a.id_requerimiento
           JOIN sigpmat.turnos t ON t.id_turno=r.id_turno
           WHERE a.id_empleado=$1::bigint
             AND a.estado IN ('asignada','confirmada')
             AND t.id_departamento <> $2::bigint
             AND t.fin_at > ($3::date::timestamp AT TIME ZONE 'America/El_Salvador')
           LIMIT 1`, [id, b.id_departamento, b.fecha_efectiva]
        );
        if (asignado.rowCount) {
          await rollback(client);
          return reply.code(409).send({ error: 'Debe resolver los turnos incompatibles antes del traslado' });
        }
        await client.query(
          `UPDATE sigpmat.empleado_departamento
           SET fecha_fin=$2::date - 1
           WHERE id_empleado=$1::bigint
             AND fecha_inicio < $2::date
             AND (fecha_fin IS NULL OR fecha_fin >= $2::date)`,
          [id, b.fecha_efectiva]
        );
        const nuevo = await client.query<{ id_vinculo: string }>(
          `INSERT INTO sigpmat.empleado_departamento
             (id_empleado,id_departamento,fecha_inicio,es_jefe)
           VALUES ($1::bigint,$2::bigint,$3::date,FALSE)
           RETURNING id_vinculo::text`,
          [id, b.id_departamento, b.fecha_efectiva]
        );
        await client.query('COMMIT');
        return reply.code(201).send({ traslado: {
          id_vinculo: nuevo.rows[0].id_vinculo,
          fecha_efectiva: b.fecha_efectiva,
          id_departamento: b.id_departamento,
          estado: 'programado'
        } });
      } catch (e) {
        await rollback(client);
        return errorDb(reply, request, e, 'Error al programar traslado');
      } finally { client.release(); }
    }
  );
}
