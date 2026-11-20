import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { pool } from '../db.js';
import { autorizar } from '../auth/routes.js';

/**
 * Datos laborales y fotografía opcional de demostración.
 * Las listas NO revelan DUI ni contactos. El detalle solo muestra esos campos
 * a ADMIN_GENERAL. La visibilidad se verifica en SQL y en la autorización.
 */
type Cuenta = { id_usuario: string; roles: string[] };
type Parametros = { id: string };
type Filtro = { departamento_id?: string; cargo?: string; estado?: string };
type EmpleadoListado = {
  id_empleado: string;
  codigo_empleado: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  estado_vinculo: string;
  foto_url: string | null;
  foto_data_url: string | null;
};
type EmpleadoDetalle = EmpleadoListado & {
  fecha_ingreso: string | null;
  dui: string | null;
  correo_contacto: string | null;
  telefono: string | null;
  numero_registro_profesional: string | null;
  departamentos: Array<{ id_departamento: string; codigo: string; nombre: string }>;
};
type NuevoEmpleado = {
  codigo_empleado: string;
  nombres: string;
  apellidos: string;
  id_cargo: string;
  id_departamento: string;
  fecha_ingreso?: string;
  dui?: string;
  correo_contacto?: string;
  telefono?: string;
  numero_registro_profesional?: string;
  foto_mime?: 'image/jpeg' | 'image/png' | 'image/webp';
  foto_base64?: string;
};

function validarFoto(mime?: string, base64?: string): Buffer | null {
  if (!mime && !base64) return null;
  if (!mime || !base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error('Imagen inválida: se necesita un JPG, PNG o WebP válido');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length < 12 || bytes.length > 200000 ||
      bytes.toString('base64') !== base64) {
    throw new Error('La fotografía debe ocupar un máximo de 200 kB');
  }
  const jpeg = mime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = mime === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp = mime === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!jpeg && !png && !webp) {
    throw new Error('Tipo de imagen no compatible con el contenido');
  }
  return bytes;
}

const PG_BIGINT_MAX = 9223372036854775807n;
const ID = '^[1-9][0-9]{0,18}$';
const idOk = (s: string): boolean =>
  /^[1-9][0-9]{0,18}$/.test(s) && BigInt(s) <= PG_BIGINT_MAX;

async function cuentaAutorizada(request: FastifyRequest, reply: FastifyReply) {
  const cuenta = await autorizar(request, reply);
  if (!cuenta) return null;
  const admin = cuenta.roles.includes('ADMIN_GENERAL');
  const jefe = cuenta.roles.includes('JEFE_AREA');
  const lectura = cuenta.roles.includes('VISITANTE_LECTURA');
  if (!admin && !jefe && !lectura) {
    reply.code(403).send({ error: 'Acceso no autorizado' });
    return null;
  }
  return { cuenta, admin, jefe, lectura };
}

async function puedeVerDepartamento(cuenta: Cuenta, idDepto: string) {
  if (cuenta.roles.includes('ADMIN_GENERAL') || cuenta.roles.includes('VISITANTE_LECTURA')) return true;
  const { rows } = await pool.query<{ autorizado: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM sigpmat.usuarios u
         JOIN sigpmat.empleados j ON j.id_empleado = u.id_empleado
         JOIN sigpmat.empleado_departamento ed ON ed.id_empleado = j.id_empleado
         JOIN sigpmat.departamentos d ON d.id_departamento = ed.id_departamento
        WHERE u.id_usuario = $1::bigint
          AND j.estado_vinculo = 'activo'
          AND d.activo = TRUE
          AND ed.id_departamento = $2::bigint
          AND ed.es_jefe = TRUE
          AND ed.fecha_inicio <= CURRENT_DATE
          AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= CURRENT_DATE)
     ) AS autorizado`,
    [cuenta.id_usuario, idDepto]
  );
  return rows[0]?.autorizado === true;
}

async function esEmpleadoVisible(cuenta: Cuenta, idEmpleado: string): Promise<boolean> {
  if (cuenta.roles.includes('ADMIN_GENERAL') || cuenta.roles.includes('VISITANTE_LECTURA')) return true;
  const { rows } = await pool.query<{ autorizado: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM sigpmat.empleados e
         JOIN sigpmat.empleado_departamento ed ON ed.id_empleado = e.id_empleado
         JOIN sigpmat.departamentos d ON d.id_departamento = ed.id_departamento
         JOIN sigpmat.empleado_departamento jefe_ed
           ON jefe_ed.id_departamento = ed.id_departamento
         JOIN sigpmat.usuarios u ON u.id_empleado = jefe_ed.id_empleado
         JOIN sigpmat.empleados jefe ON jefe.id_empleado = jefe_ed.id_empleado
        WHERE e.id_empleado = $1::bigint
          AND u.id_usuario = $2::bigint
          AND e.estado_vinculo = 'activo'
          AND jefe.estado_vinculo = 'activo'
          AND d.activo = TRUE
          AND ed.fecha_inicio <= CURRENT_DATE
          AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= CURRENT_DATE)
          AND jefe_ed.es_jefe = TRUE
          AND jefe_ed.fecha_inicio <= CURRENT_DATE
          AND (jefe_ed.fecha_fin IS NULL OR jefe_ed.fecha_fin >= CURRENT_DATE)
     ) AS autorizado`,
    [idEmpleado, cuenta.id_usuario]
  );
  return rows[0]?.autorizado === true;
}

// Formato ISO de fecha calendárica válida, sin conversiones de huso horario.
function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [ano, mes, dia] = fecha.split('-').map(Number);
  const utc = new Date(0);
  utc.setUTCFullYear(ano, mes - 1, dia);
  utc.setUTCHours(0, 0, 0, 0);
  return utc.getUTCFullYear() === ano && utc.getUTCMonth() + 1 === mes && utc.getUTCDate() === dia;
}

export function registrarRutasEmpleados(app: FastifyInstance): void {
  app.get<{ Querystring: Filtro }>(
    '/api/empleados',
    {
      schema: {
        querystring: {
          type: 'object', additionalProperties: false,
          properties: {
            departamento_id: { type: 'string', pattern: ID, maxLength: 19 },
            cargo: { type: 'string', minLength: 1, maxLength: 70 },
            estado: { type: 'string', enum: ['activo','inactivo','suspendido'] }
          }
        }
      }
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const auth = await cuentaAutorizada(request, reply);
      if (!auth) return reply;
      const { cargo, estado } = request.query;
      const idDepto = request.query.departamento_id;
      if (idDepto && !idOk(idDepto)) {
        return reply.code(400).send({ error: 'Identificador de departamento invalido' });
      }
      if (idDepto && !await puedeVerDepartamento(auth.cuenta, idDepto)) {
        return reply.code(403).send({ error: 'Departamento no autorizado' });
      }

      const { rows } = await pool.query<EmpleadoListado>(
        `SELECT e.id_empleado::text, e.codigo_empleado, e.nombres, e.apellidos,
                c.nombre AS cargo, e.estado_vinculo, e.foto_url,
                CASE WHEN e.foto_bytes IS NULL THEN NULL
                     ELSE 'data:' || e.foto_mime || ';base64,' || translate(encode(e.foto_bytes, 'base64'), chr(10) || chr(13), '')
                END AS foto_data_url
           FROM sigpmat.empleados e
           JOIN sigpmat.cargos c ON c.id_cargo = e.id_cargo
          WHERE (
                  $1::bigint IS NULL
                  OR EXISTS (
                    SELECT 1 FROM sigpmat.empleado_departamento ed
                    WHERE ed.id_empleado = e.id_empleado
                      AND ed.id_departamento = $1::bigint
                      AND ed.fecha_inicio <= CURRENT_DATE
                      AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= CURRENT_DATE)
                  )
                )
            AND ($4::varchar IS NULL OR c.nombre=$4::varchar)
            AND ($5::varchar IS NULL OR e.estado_vinculo=$5::varchar)
            AND (
                  $2::boolean
                  OR (
                    e.estado_vinculo = 'activo'
                    AND EXISTS (
                      SELECT 1
                        FROM sigpmat.empleado_departamento ed
                        JOIN sigpmat.departamentos d
                          ON d.id_departamento = ed.id_departamento
                        JOIN sigpmat.empleado_departamento jefe_ed
                          ON jefe_ed.id_departamento = ed.id_departamento
                        JOIN sigpmat.usuarios u ON u.id_empleado = jefe_ed.id_empleado
                        JOIN sigpmat.empleados jefe ON jefe.id_empleado = jefe_ed.id_empleado
                       WHERE ed.id_empleado = e.id_empleado
                         AND u.id_usuario = $3::bigint
                         AND d.activo = TRUE
                         AND jefe.estado_vinculo = 'activo'
                         AND ed.fecha_inicio <= CURRENT_DATE
                         AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= CURRENT_DATE)
                         AND jefe_ed.es_jefe = TRUE
                         AND jefe_ed.fecha_inicio <= CURRENT_DATE
                         AND (jefe_ed.fecha_fin IS NULL OR jefe_ed.fecha_fin >= CURRENT_DATE)
                    )
                  )
                )
          ORDER BY e.codigo_empleado, e.id_empleado
          LIMIT 100`,
        [idDepto ?? null, auth.admin || auth.lectura, auth.cuenta.id_usuario,
          cargo ?? null, estado ?? null]
      );
      return { empleados: rows, limite: 100 };
    }
  );

  app.get<{ Params: Parametros }>(
    '/api/empleados/:id',
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const auth = await cuentaAutorizada(request, reply);
      if (!auth) return reply;
      const { id } = request.params;
      if (!idOk(id)) {
        return reply.code(400).send({ error: 'Identificador de empleado invalido' });
      }
      // No revelar si existe un empleado fuera del alcance del jefe: respuesta 404.
      if (!await esEmpleadoVisible(auth.cuenta, id)) {
        return reply.code(404).send({ error: 'Empleado no encontrado' });
      }
      const { rows } = await pool.query<Omit<EmpleadoDetalle, 'departamentos'>>(
        `SELECT e.id_empleado::text, e.codigo_empleado, e.nombres,
                e.apellidos, c.nombre AS cargo, e.estado_vinculo,
                to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
                CASE WHEN $2::boolean THEN e.dui ELSE NULL END AS dui,
                CASE WHEN $2::boolean THEN e.correo_contacto ELSE NULL END AS correo_contacto,
                CASE WHEN $2::boolean THEN e.telefono ELSE NULL END AS telefono,
                CASE WHEN $2::boolean THEN e.numero_registro_profesional ELSE NULL END AS numero_registro_profesional,
                e.foto_url,
                CASE WHEN e.foto_bytes IS NULL THEN NULL
                     ELSE 'data:' || e.foto_mime || ';base64,' || translate(encode(e.foto_bytes, 'base64'), chr(10) || chr(13), '')
                END AS foto_data_url
           FROM sigpmat.empleados e
           JOIN sigpmat.cargos c ON c.id_cargo = e.id_cargo
          WHERE e.id_empleado = $1::bigint`,
        [id, auth.admin]
      );
      if (!rows[0]) return reply.code(404).send({ error: 'Empleado no encontrado' });

      const { rows: departamentos } = await pool.query<{
        id_departamento: string; codigo: string; nombre: string;
      }>(
        `SELECT DISTINCT d.id_departamento::text, d.codigo, d.nombre
           FROM sigpmat.empleado_departamento ed
           JOIN sigpmat.departamentos d ON d.id_departamento = ed.id_departamento
          WHERE ed.id_empleado = $1::bigint
            AND ed.fecha_inicio <= CURRENT_DATE
            AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= CURRENT_DATE)
            AND (
              $2::boolean OR EXISTS (
                SELECT 1 FROM sigpmat.usuarios u
                JOIN sigpmat.empleado_departamento j
                  ON j.id_empleado = u.id_empleado
                JOIN sigpmat.empleados e_j ON e_j.id_empleado = j.id_empleado
                WHERE u.id_usuario = $3::bigint
                  AND e_j.estado_vinculo = 'activo'
                  AND j.id_departamento = ed.id_departamento
                  AND j.es_jefe = TRUE
                  AND j.fecha_inicio <= CURRENT_DATE
                  AND (j.fecha_fin IS NULL OR j.fecha_fin >= CURRENT_DATE)
              )
            )
          ORDER BY d.codigo`,
        [id, auth.admin || auth.lectura, auth.cuenta.id_usuario]
      );
      const empleado: EmpleadoDetalle = { ...rows[0], departamentos };
      return { empleado };
    }
  );

  app.post<{ Body: NuevoEmpleado }>(
    '/api/empleados',
    {
      schema: {
        body: {
          type: 'object', additionalProperties: false,
          required: ['codigo_empleado', 'nombres', 'apellidos', 'id_cargo', 'id_departamento'],
          properties: {
            codigo_empleado: { type: 'string', pattern: '^[A-Za-z0-9-]{3,20}$' },
            nombres: { type: 'string', minLength: 1, maxLength: 90 },
            apellidos: { type: 'string', minLength: 1, maxLength: 90 },
            id_cargo: { type: 'string', pattern: ID, maxLength: 19 },
            id_departamento: { type: 'string', pattern: ID, maxLength: 19 },
            fecha_ingreso: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            dui: { type: 'string', pattern: '^[0-9]{8}-[0-9]$', maxLength: 10 },
            correo_contacto: { type: 'string', minLength: 3, maxLength: 150 },
            telefono: { type: 'string', pattern: '^[0-9]{4}-[0-9]{4}$', maxLength: 9 },
            numero_registro_profesional: { type: 'string', minLength: 3, maxLength: 40 },
            foto_mime: { type: 'string', enum: ['image/jpeg','image/png','image/webp'] },
            foto_base64: { type: 'string', minLength: 16, maxLength: 280000 }
          }
        }
      }
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const cuenta = await autorizar(request, reply, 'ADMIN_GENERAL');
      if (!cuenta) return reply;
      const data = request.body;
      if (!idOk(data.id_cargo) || !idOk(data.id_departamento)) {
        return reply.code(400).send({ error: 'Identificador numerico invalido' });
      }
      if (data.fecha_ingreso && !fechaValida(data.fecha_ingreso)) {
        return reply.code(400).send({ error: 'Fecha de ingreso invalida' });
      }
      let fotoBytes: Buffer | null;
      try {
        fotoBytes = validarFoto(data.foto_mime, data.foto_base64);
      } catch (error) {
        return reply.code(400).send({ error: error instanceof Error ? error.message : 'Foto inválida' });
      }
      const nombres = data.nombres.trim();
      const apellidos = data.apellidos.trim();
      if (!nombres || !apellidos) {
        return reply.code(400).send({ error: 'Nombres y apellidos requeridos' });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: catalogos } = await client.query<{ cargo_activo: boolean; departamento_activo: boolean }>(
          `SELECT
             EXISTS(SELECT 1 FROM sigpmat.cargos WHERE id_cargo=$1::bigint AND activo) AS cargo_activo,
             EXISTS(SELECT 1 FROM sigpmat.departamentos WHERE id_departamento=$2::bigint AND activo) AS departamento_activo`,
          [data.id_cargo, data.id_departamento]
        );
        if (!catalogos[0]?.cargo_activo || !catalogos[0]?.departamento_activo) {
          await client.query('ROLLBACK');
          return reply.code(422).send({ error: 'Cargo o departamento inexistente/inactivo' });
        }
        const { rows } = await client.query<{ id_empleado: string; codigo_empleado: string }>(
          `INSERT INTO sigpmat.empleados
              (codigo_empleado, nombres, apellidos, id_cargo, fecha_ingreso, estado_vinculo,
               dui, correo_contacto, telefono, numero_registro_profesional, foto_mime, foto_bytes)
           VALUES ($1, $2, $3, $4::bigint, $5::date, 'activo', $6, $7, $8, $9, $10, $11)
           RETURNING id_empleado::text, codigo_empleado`,
          [data.codigo_empleado.trim(), nombres, apellidos, data.id_cargo,
           data.fecha_ingreso ?? null, data.dui ?? null, data.correo_contacto?.trim() ?? null,
           data.telefono ?? null, data.numero_registro_profesional?.trim() ?? null,
           fotoBytes ? data.foto_mime : null, fotoBytes]
        );
        const nuevo = rows[0];
        if (!nuevo) throw new Error('No se obtuvo el nuevo empleado');
        await client.query(
          `INSERT INTO sigpmat.empleado_departamento
              (id_empleado, id_departamento, fecha_inicio, es_jefe)
           VALUES ($1::bigint, $2::bigint, CURRENT_DATE, FALSE)`,
          [nuevo.id_empleado, data.id_departamento]
        );
        await client.query('COMMIT');
        return reply.code(201).send({ empleado: nuevo });
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* conexión posiblemente cerrada */ }
        const codigo = (error as { code?: string } | null)?.code;
        if (codigo === '23505') {
          return reply.code(409).send({ error: 'Código de empleado, DUI o registro profesional ya registrado' });
        }
        request.log.error({ err: error }, 'No se pudo registrar el empleado');
        return reply.code(500).send({ error: 'No se pudo registrar el empleado' });
      } finally {
        client.release();
      }
    }
  );
}
