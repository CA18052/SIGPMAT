-- SIGPMAT | Escenario de prueba de departamentos (NO es una migracion de estructura)
-- Requiere: base sigpmat_dev, usuario sigpmat_app, cuentas admin.dev y jefe.dev existentes.
-- Se puede ejecutar nuevamente sin duplicar los registros de ensayo.
-- Las filas creadas PERMANECEN en la BD de desarrollo. No hay datos personales reales.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = pg_catalog;
DO $demo$
DECLARE
    v_cargo bigint;
    v_area_a bigint;
    v_area_b bigint;
    v_jefe bigint;
    v_otro bigint;
    v_usuario_jefe bigint;
BEGIN
    IF current_database() <> 'sigpmat_dev' OR session_user <> 'sigpmat_app' THEN
        RAISE EXCEPTION 'Escenario autorizado solo en sigpmat_dev como sigpmat_app';
    END IF;

    -- Una sola categoria de cargo de ensayo; no se crean identidades reales.
    INSERT INTO sigpmat.cargos (nombre, categoria, activo)
    VALUES ('Cargo médico de ensayo SIGPMAT', 'medico', TRUE)
    ON CONFLICT (nombre) DO NOTHING;
    SELECT id_cargo INTO v_cargo FROM sigpmat.cargos
    WHERE nombre = 'Cargo médico de ensayo SIGPMAT' AND categoria = 'medico' AND activo;
    IF v_cargo IS NULL THEN RAISE EXCEPTION 'Cargo de ensayo incompatible'; END IF;

    INSERT INTO sigpmat.departamentos (codigo, nombre, activo)
    VALUES ('DEV-AREA-A', 'Departamento A de ensayo', TRUE)
    ON CONFLICT (codigo) DO NOTHING;
    SELECT id_departamento INTO v_area_a FROM sigpmat.departamentos
    WHERE codigo = 'DEV-AREA-A' AND nombre = 'Departamento A de ensayo' AND activo;
    IF v_area_a IS NULL THEN RAISE EXCEPTION 'Departamento A de ensayo incompatible'; END IF;

    INSERT INTO sigpmat.departamentos (codigo, nombre, activo)
    VALUES ('DEV-AREA-B', 'Departamento B de ensayo', TRUE)
    ON CONFLICT (codigo) DO NOTHING;
    SELECT id_departamento INTO v_area_b FROM sigpmat.departamentos
    WHERE codigo = 'DEV-AREA-B' AND nombre = 'Departamento B de ensayo' AND activo;
    IF v_area_b IS NULL THEN RAISE EXCEPTION 'Departamento B de ensayo incompatible'; END IF;

    INSERT INTO sigpmat.empleados
      (codigo_empleado, nombres, apellidos, id_cargo, estado_vinculo)
    VALUES ('DEV-JEFE-001', 'Jefatura', 'Ficticia', v_cargo, 'activo')
    ON CONFLICT (codigo_empleado) DO NOTHING;
    SELECT id_empleado INTO v_jefe FROM sigpmat.empleados
    WHERE codigo_empleado = 'DEV-JEFE-001'
      AND nombres = 'Jefatura' AND apellidos = 'Ficticia'
      AND id_cargo = v_cargo AND estado_vinculo = 'activo';
    IF v_jefe IS NULL THEN RAISE EXCEPTION 'Empleado jefe de ensayo incompatible'; END IF;

    INSERT INTO sigpmat.empleados
      (codigo_empleado, nombres, apellidos, id_cargo, estado_vinculo)
    VALUES ('DEV-EMP-002', 'Colaborador', 'Ficticio', v_cargo, 'activo')
    ON CONFLICT (codigo_empleado) DO NOTHING;
    SELECT id_empleado INTO v_otro FROM sigpmat.empleados
    WHERE codigo_empleado = 'DEV-EMP-002'
      AND nombres = 'Colaborador' AND apellidos = 'Ficticio'
      AND id_cargo = v_cargo AND estado_vinculo = 'activo';
    IF v_otro IS NULL THEN RAISE EXCEPTION 'Empleado del Departamento B incompatible'; END IF;

    SELECT id_usuario INTO v_usuario_jefe FROM sigpmat.usuarios
    WHERE nombre_usuario = 'jefe.dev' AND estado = 'activa' FOR UPDATE;
    IF v_usuario_jefe IS NULL THEN
        RAISE EXCEPTION 'Falta la cuenta activa jefe.dev';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM sigpmat.usuario_roles ur JOIN sigpmat.roles r ON r.id_rol = ur.id_rol
        WHERE ur.id_usuario = v_usuario_jefe AND r.codigo = 'JEFE_AREA' AND r.activo
    ) OR EXISTS (
        SELECT 1 FROM sigpmat.usuario_roles ur JOIN sigpmat.roles r ON r.id_rol = ur.id_rol
        WHERE ur.id_usuario = v_usuario_jefe AND r.codigo = 'ADMIN_GENERAL' AND r.activo
    ) THEN
        RAISE EXCEPTION 'Los roles de jefe.dev no corresponden al escenario';
    END IF;
    IF EXISTS (
        SELECT 1 FROM sigpmat.usuarios
        WHERE id_usuario = v_usuario_jefe AND id_empleado IS NOT NULL AND id_empleado <> v_jefe
    ) THEN
        RAISE EXCEPTION 'jefe.dev ya esta vinculado a otro empleado; no se altera';
    END IF;

    UPDATE sigpmat.usuarios
       SET id_empleado = v_jefe
     WHERE id_usuario = v_usuario_jefe AND id_empleado IS NULL;

    -- Unicamente la jefatura A; B contiene otro empleado sin jefatura.
    IF NOT EXISTS (
        SELECT 1 FROM sigpmat.empleado_departamento
        WHERE id_empleado = v_jefe AND id_departamento = v_area_a
          AND es_jefe = TRUE AND fecha_inicio <= CURRENT_DATE
          AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
    ) THEN
        INSERT INTO sigpmat.empleado_departamento
            (id_empleado, id_departamento, fecha_inicio, es_jefe)
        VALUES (v_jefe, v_area_a, CURRENT_DATE, TRUE);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM sigpmat.empleado_departamento
        WHERE id_empleado = v_otro AND id_departamento = v_area_b
          AND es_jefe = FALSE AND fecha_inicio <= CURRENT_DATE
          AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
    ) THEN
        INSERT INTO sigpmat.empleado_departamento
            (id_empleado, id_departamento, fecha_inicio, es_jefe)
        VALUES (v_otro, v_area_b, CURRENT_DATE, FALSE);
    END IF;

    IF EXISTS (
        SELECT 1 FROM sigpmat.empleado_departamento ed
        WHERE ed.id_empleado = v_jefe AND ed.es_jefe
          AND ed.fecha_inicio <= CURRENT_DATE
          AND (ed.fecha_fin IS NULL OR ed.fecha_fin >= CURRENT_DATE)
          AND ed.id_departamento <> v_area_a
    ) THEN
        RAISE EXCEPTION 'El jefe de ensayo ya tiene otra jefatura vigente';
    END IF;

    RAISE NOTICE 'OK: dos departamentos ficticios A y B preparados';
    RAISE NOTICE 'OK: dos empleados ficticios preparados';
    RAISE NOTICE 'OK: jefe.dev vinculado exclusivamente a la jefatura del area A';
END;
$demo$;
COMMIT;
