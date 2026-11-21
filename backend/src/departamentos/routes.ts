import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { pool } from '../db.js';
import { autorizar } from '../auth/routes.js';

type DeptRow = {
  id_departamento: string;
  codigo: string;
  nombre: string;
  ubicacion?: string | null;
  extension?: string | null;
  empleados_activos?: number;
};
type DeptParams = { id: string };
type EmpleadoRow = {
  id_empleado: string;
  codigo_empleado: string;
  nombres: string;
  apellidos: string;
};

const MAX_PG_BIGINT = 9223372036854775807n;

function idValido(id: string): boolean {
  return /^[1-9][0-9]{0,18}$/.test(id) && BigInt(id) <= MAX_PG_BIGINT;
}

async function tieneJefaturaVigente(idUsuario: string, idDepto: string): Promise<boolean> {
  const result = await pool.query<{ autorizado: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM sigpmat.usuarios u
         JOIN sigpmat.empleados e ON e.id_empleado = u.id_empleado
         JOIN sigpmat.empleado_departamento ed ON ed.id_empleado = e.id_empleado
         JOIN sigpmat.departamentos d ON d.id_departamento = ed.id_departamento
        WHERE u.id_usuario = $1::bigint
          AND ed.id_departamento = $2::bigint
          AND e.estado_vinculo = 'activo'
          AND ed.es_jefe = TRUE
          AND ed.fecha_inicio <= CURRENT_DATE
          AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= CURRENT_DATE)
          AND d.activo = TRUE
     ) AS autorizado`,
    [idUsuario, idDepto]
  );
  return result.rows[0]?.autorizado === true;
}

async function comprobarAcceso(
  request: FastifyRequest,
  reply: FastifyReply,
  idDepto?: string
): Promise<{ idUsuario: string; admin: boolean } | null> {
  const cuenta = await autorizar(request, reply);
  if (!cuenta) return null;

  const admin = cuenta.roles.includes('ADMIN_GENERAL');
  const jefe = cuenta.roles.includes('JEFE_AREA');
  const lectura = cuenta.roles.includes('VISITANTE_LECTURA');
  if (!admin && !jefe && !lectura) {
    reply.code(403).send({ error: 'Acceso no autorizado' });
    return null;
  }
  if (!admin && !lectura && idDepto && !(await tieneJefaturaVigente(cuenta.id_usuario, idDepto))) {
    reply.code(403).send({ error: 'Departamento no autorizado' });
    return null;
  }
  return { idUsuario: cuenta.id_usuario, admin: admin || lectura };
}

export function registrarRutasDepartamentos(app: FastifyInstance): void {
  // Un administrador consulta todas las areas activas.
  // Un jefe consulta UNICAMENTE las areas donde ejerce jefatura vigente.
  app.get('/api/departamentos', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await comprobarAcceso(request, reply);
    if (!auth) return reply;

    const { rows } = await pool.query<DeptRow>(
      `SELECT d.id_departamento::text, d.codigo, d.nombre, d.ubicacion, d.extension,
                (SELECT count(DISTINCT e.id_empleado)::integer
                   FROM sigpmat.empleado_departamento ed
                   JOIN sigpmat.empleados e ON e.id_empleado=ed.id_empleado
                  WHERE ed.id_departamento=d.id_departamento AND e.estado_vinculo='activo'
                    AND ed.fecha_inicio<=CURRENT_DATE
                    AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=CURRENT_DATE)) AS empleados_activos
         FROM sigpmat.departamentos d
        WHERE d.activo = TRUE
          AND (
            $1::boolean OR EXISTS (
              SELECT 1
                FROM sigpmat.usuarios u
                JOIN sigpmat.empleados e ON e.id_empleado = u.id_empleado
                JOIN sigpmat.empleado_departamento ed ON ed.id_empleado = e.id_empleado
               WHERE u.id_usuario = $2::bigint
                 AND ed.id_departamento = d.id_departamento
                 AND e.estado_vinculo = 'activo'
                 AND ed.es_jefe = TRUE
                 AND ed.fecha_inicio <= CURRENT_DATE
                 AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= CURRENT_DATE)
            )
          )
        ORDER BY d.codigo`,
      [auth.admin, auth.idUsuario]
    );
    return { departamentos: rows };
  });

  // Lista limitada a identificadores profesionales, sin DUI ni contacto.
  app.get<{ Params: DeptParams }>('/api/departamentos/:id/empleados', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { id } = request.params;
    if (!idValido(id)) {
      return reply.code(400).send({ error: 'Identificador de departamento invalido' });
    }
    const auth = await comprobarAcceso(request, reply, id);
    if (!auth) return reply;

    const dep = await pool.query<DeptRow>(
      `SELECT id_departamento::text, codigo, nombre
         FROM sigpmat.departamentos
        WHERE id_departamento = $1::bigint AND activo = TRUE`,
      [id]
    );
    if (!dep.rows[0]) {
      return reply.code(404).send({ error: 'Departamento no encontrado' });
    }

    const empleados = await pool.query<EmpleadoRow>(
      `SELECT DISTINCT e.id_empleado::text, e.codigo_empleado,
              e.nombres, e.apellidos
         FROM sigpmat.empleados e
         JOIN sigpmat.empleado_departamento ed
           ON ed.id_empleado = e.id_empleado
        WHERE ed.id_departamento = $1::bigint
          AND e.estado_vinculo = 'activo'
          AND ed.fecha_inicio <= CURRENT_DATE
          AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= CURRENT_DATE)
        ORDER BY e.codigo_empleado, e.id_empleado::text`,
      [id]
    );
    return { departamento: dep.rows[0], empleados: empleados.rows };
  });
}
