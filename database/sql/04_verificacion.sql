-- SIGPMAT | Diagnostico 004 | Validaciones sin alterar datos.
-- Puede ejecutarse como sigpmat_owner o administrador despues de migraciones 001-003.
\echo '========== VERSION Y CONTEXTO =========='
SELECT current_database() AS bd, current_user AS usuario, version() AS version;
\echo '========== CONTEOS DE OBJETOS =========='
WITH conteos AS (
  SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='sigpmat' AND c.relkind='r') AS tablas,
    (SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='sigpmat' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped) AS columnas,
    (SELECT count(*) FROM pg_constraint ct JOIN pg_namespace n ON n.oid=ct.connamespace
      WHERE n.nspname='sigpmat' AND ct.contype='p') AS claves_primarias,
    (SELECT count(*) FROM pg_constraint ct JOIN pg_namespace n ON n.oid=ct.connamespace
      WHERE n.nspname='sigpmat' AND ct.contype='f') AS claves_foraneas
)
SELECT *, tablas=24 AND columnas=176 AND claves_primarias=24 AND claves_foraneas=42 AS coincide_con_dossier_corregido
FROM conteos;
\echo '========== ROLES BASICOS =========='
SELECT codigo, nombre, activo FROM sigpmat.roles ORDER BY codigo;
\echo '========== PERMISOS DEL BACKEND =========='
SELECT
  has_schema_privilege('sigpmat_app', 'sigpmat', 'USAGE') AS puede_usar_esquema,
  has_table_privilege('sigpmat_app','sigpmat.roles','SELECT') AS puede_leer_roles,
  has_table_privilege('sigpmat_app','sigpmat.roles','INSERT') AS puede_alterar_catalogo_roles,
  has_table_privilege('sigpmat_app','sigpmat.usuarios','INSERT') AS puede_crear_usuarios,
  has_table_privilege('sigpmat_app','sigpmat.auditoria','UPDATE') AS puede_editar_auditoria,
  has_table_privilege('sigpmat_app','sigpmat.empleados','DELETE') AS puede_eliminar_empleados;
\echo '========== INTEGRIDAD DEL ESQUEMA =========='
DO $verificar$
DECLARE v_tablas integer; v_campos integer; v_pk integer; v_fk integer; v_roles integer;
BEGIN
 SELECT count(*) INTO v_tablas FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='sigpmat' AND c.relkind='r';
 SELECT count(*) INTO v_campos FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='sigpmat' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped;
 SELECT count(*) INTO v_pk FROM pg_constraint ct JOIN pg_namespace n ON n.oid=ct.connamespace
    WHERE n.nspname='sigpmat' AND ct.contype='p';
 SELECT count(*) INTO v_fk FROM pg_constraint ct JOIN pg_namespace n ON n.oid=ct.connamespace
    WHERE n.nspname='sigpmat' AND ct.contype='f';
 SELECT count(*) INTO v_roles FROM sigpmat.roles;
 IF (v_tablas,v_campos,v_pk,v_fk,v_roles) IS DISTINCT FROM (24,176,24,42,3) THEN
   RAISE EXCEPTION 'Verificacion fallo: %,%,%,%,%', v_tablas,v_campos,v_pk,v_fk,v_roles;
 END IF;
 IF NOT has_schema_privilege('sigpmat_app','sigpmat','USAGE') THEN
   RAISE EXCEPTION 'sigpmat_app no tiene USAGE del esquema';
 END IF;
 IF has_table_privilege('sigpmat_app','sigpmat.roles','INSERT') OR has_table_privilege('sigpmat_app','sigpmat.auditoria','UPDATE') THEN
   RAISE EXCEPTION 'Los permisos de administracion/auditoria son excesivos';
 END IF;
 RAISE NOTICE 'Estructura y permisos basicos verificados: 24 tablas, 176 columnas, 24 PK, 42 FK y 3 roles.';
END
$verificar$;
