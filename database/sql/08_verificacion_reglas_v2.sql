-- SIGPMAT | 008 | Inventario de triggers sin modificar la base
\echo '========== CONTEXTO =========='
SELECT current_database(), current_user, version();
\echo '========== DISPARADORES OPERATIVOS =========='
SELECT event_object_table AS tabla, trigger_name AS disparador, action_timing AS momento,
       event_manipulation AS evento
FROM information_schema.triggers
WHERE trigger_schema = 'sigpmat' AND trigger_name LIKE 'tg_06_%'
ORDER BY tabla, disparador, evento;
\echo '========== TOTAL DE TRIGGERS DISTINTOS =========='
SELECT count(*) AS triggers_v2
FROM pg_trigger tg
JOIN pg_class tb ON tb.oid = tg.tgrelid
JOIN pg_namespace ns ON ns.oid = tb.relnamespace
WHERE ns.nspname = 'sigpmat'
  AND tg.tgname LIKE 'tg_06_%' AND NOT tg.tgisinternal;
\echo '========== CONTEOS BASE PRESERVADOS =========='
WITH base AS (
 SELECT count(*) AS tablas FROM information_schema.tables
 WHERE table_schema = 'sigpmat' AND table_type = 'BASE TABLE'
), col AS (
 SELECT count(*) AS columnas FROM information_schema.columns WHERE table_schema = 'sigpmat'
), fk AS (
 SELECT count(*) AS claves_foraneas FROM pg_constraint c
 JOIN pg_namespace n ON n.oid = c.connamespace
 WHERE n.nspname = 'sigpmat' AND c.contype = 'f'
)
SELECT tablas, columnas, claves_foraneas, (tablas = 24 AND columnas = 176 AND claves_foraneas = 42) AS estructura_preservada
FROM base CROSS JOIN col CROSS JOIN fk;
