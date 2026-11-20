-- SIGPMAT | Paquete 04 — Auditoría reproducible SOLO LECTURA.
-- Ejecutar en Neon neondb: no modifica registros, cuentas, esquemas ni roles.
-- Resultado esperado: anomalias = 0 en BD-01 a BD-10.
SELECT 'BD-01' AS prueba, 'DUI duplicados' AS descripcion, COUNT(*)::integer AS anomalias
FROM (SELECT dui FROM sigpmat.empleados WHERE dui IS NOT NULL GROUP BY dui HAVING COUNT(*)>1) duplicados

UNION ALL SELECT 'BD-02', 'DUI formato no conforme', COUNT(*)::integer
FROM sigpmat.empleados WHERE dui IS NOT NULL AND dui !~ '^[0-9]{8}-[0-9]$'

UNION ALL SELECT 'BD-03', 'Turnos con fin <= inicio', COUNT(*)::integer
FROM sigpmat.turnos WHERE fin_at<=inicio_at

UNION ALL SELECT 'BD-04', 'Asignaciones sin requerimiento', COUNT(*)::integer
FROM sigpmat.asignaciones_turno a LEFT JOIN sigpmat.requerimientos_turno r
ON r.id_requerimiento=a.id_requerimiento WHERE r.id_requerimiento IS NULL

UNION ALL SELECT 'BD-05', 'Requerimientos sobreocupados', COUNT(*)::integer
FROM sigpmat.requerimientos_turno r WHERE
(SELECT COUNT(*) FROM sigpmat.asignaciones_turno a
 WHERE a.id_requerimiento=r.id_requerimiento AND a.estado IN ('asignada','confirmada')) > r.cupos_requeridos

UNION ALL SELECT 'BD-06', 'Empleados sin cargo válido', COUNT(*)::integer
FROM sigpmat.empleados e LEFT JOIN sigpmat.cargos c ON c.id_cargo=e.id_cargo
WHERE c.id_cargo IS NULL

UNION ALL SELECT 'BD-07', 'Cuentas activas sin rol activo', COUNT(*)::integer
FROM sigpmat.usuarios u
WHERE u.estado='activa' AND NOT EXISTS(
 SELECT 1 FROM sigpmat.usuario_roles ur JOIN sigpmat.roles r ON r.id_rol=ur.id_rol
 WHERE ur.id_usuario=u.id_usuario AND r.activo)

UNION ALL SELECT 'BD-08', 'Rutas de retratos ajenas al catálogo', COUNT(*)::integer
FROM sigpmat.empleados e
WHERE e.foto_url IS NOT NULL AND e.foto_url NOT LIKE '/retratos/%'

UNION ALL SELECT 'BD-09', 'Empleados activos sin departamento vigente', COUNT(*)::integer
FROM sigpmat.empleados e
WHERE e.estado_vinculo='activo' AND NOT EXISTS(
 SELECT 1 FROM sigpmat.empleado_departamento ed
 WHERE ed.id_empleado=e.id_empleado AND ed.fecha_inicio<=CURRENT_DATE
 AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=CURRENT_DATE))

UNION ALL SELECT 'BD-10', 'Asignaciones activas de empleados no activos', COUNT(*)::integer
FROM sigpmat.asignaciones_turno a JOIN sigpmat.empleados e ON e.id_empleado=a.id_empleado
WHERE a.estado IN ('asignada','confirmada') AND e.estado_vinculo<>'activo'

ORDER BY prueba;
