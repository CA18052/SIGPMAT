-- Comprobacion SELECT-only; funciona como sigpmat_app o sigpmat_owner.
\set ON_ERROR_STOP on
\echo '========== DEPARTAMENTOS DE ENSAYO =========='
SELECT codigo, nombre, activo FROM sigpmat.departamentos
WHERE codigo IN ('DEV-AREA-A', 'DEV-AREA-B') ORDER BY codigo;
\echo '========== ADSCRIPCIONES VIGENTES DE ENSAYO =========='
SELECT e.codigo_empleado, d.codigo AS departamento, ed.es_jefe,
       ed.fecha_inicio, ed.fecha_fin
FROM sigpmat.empleado_departamento ed
JOIN sigpmat.empleados e ON e.id_empleado = ed.id_empleado
JOIN sigpmat.departamentos d ON d.id_departamento = ed.id_departamento
WHERE e.codigo_empleado IN ('DEV-JEFE-001', 'DEV-EMP-002')
  AND ed.fecha_inicio <= CURRENT_DATE
  AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= CURRENT_DATE)
ORDER BY e.codigo_empleado, d.codigo;
\echo '========== VINCULO jefe.dev =========='
SELECT u.nombre_usuario, e.codigo_empleado, r.codigo AS rol
FROM sigpmat.usuarios u
LEFT JOIN sigpmat.empleados e ON e.id_empleado = u.id_empleado
LEFT JOIN sigpmat.usuario_roles ur ON ur.id_usuario = u.id_usuario
LEFT JOIN sigpmat.roles r ON r.id_rol = ur.id_rol
WHERE u.nombre_usuario = 'jefe.dev';
\echo '========== ESTRUCTURA PRESERVADA =========='
SELECT COUNT(*) AS tablas
FROM information_schema.tables
WHERE table_schema = 'sigpmat' AND table_type = 'BASE TABLE';
