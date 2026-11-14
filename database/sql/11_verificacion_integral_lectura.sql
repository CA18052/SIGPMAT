-- SIGPMAT / verificacion de solo lectura; no modifica registros.
\echo '===== INSTALACION SIGPMAT - ESTRUCTURA ====='
SELECT (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'sigpmat' AND table_type = 'BASE TABLE') AS tablas,
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'sigpmat') AS columnas,
       (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n
         ON n.oid = c.connamespace
         WHERE n.nspname='sigpmat' AND c.contype='f') AS claves_foraneas,
       (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
         JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='sigpmat' AND t.tgname LIKE 'tg_06_%' AND NOT t.tgisinternal) AS triggers_v2;
\echo '===== ROLES FUNCIONALES ====='
SELECT codigo, activo FROM sigpmat.roles ORDER BY codigo;
\echo '===== USUARIOS DE ENSAYO (SIN HASHES) ====='
SELECT u.nombre_usuario, u.estado, r.codigo AS rol
FROM sigpmat.usuarios u
JOIN sigpmat.usuario_roles ur ON ur.id_usuario=u.id_usuario
JOIN sigpmat.roles r ON r.id_rol=ur.id_rol
WHERE u.nombre_usuario IN ('admin.dev','jefe.dev') ORDER BY u.nombre_usuario;
\echo '===== DEPARTAMENTOS DE ENSAYO ====='
SELECT codigo, activo FROM sigpmat.departamentos WHERE codigo LIKE 'DEV-AREA-%' ORDER BY codigo;
\echo '===== EMPLEADOS DE ENSAYO ====='
SELECT codigo_empleado, estado_vinculo FROM sigpmat.empleados
WHERE codigo_empleado LIKE 'DEV-%' ORDER BY codigo_empleado;
