-- SIGPMAT | Paquete 07: permisos mínimos de eliminación para CRUD administrativo.
-- Diagnóstico Neon 20/11/2026: sigpmat_app tenía SELECT/INSERT/UPDATE, pero no DELETE
-- sobre empleados, departamentos, turnos ni sus tablas de vínculo/requerimientos.
-- El backend autoriza ADMIN_GENERAL y protege las claves foráneas mediante transacciones.
-- Se otorga DELETE solo a las seis tablas que el CRUD necesita; ningún dato se elimina.
BEGIN;
GRANT DELETE ON TABLE
  sigpmat.empleados,
  sigpmat.empleado_departamento,
  sigpmat.empleado_especialidad,
  sigpmat.departamentos,
  sigpmat.turnos,
  sigpmat.requerimientos_turno
TO sigpmat_app;
COMMIT;

-- Verificación de privilegios, sin cambios de datos:
SELECT n.tabla, has_table_privilege('sigpmat_app', n.tabla, 'DELETE') AS permitido
FROM (VALUES
 ('sigpmat.empleados'),
 ('sigpmat.empleado_departamento'),
 ('sigpmat.empleado_especialidad'),
 ('sigpmat.departamentos'),
 ('sigpmat.turnos'),
 ('sigpmat.requerimientos_turno')
) AS n(tabla);
