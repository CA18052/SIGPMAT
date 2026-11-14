-- SIGPMAT | Migracion 006 | Integridad operativa prioritaria (v2.0)
-- Base: sigpmat_dev; usuario: sigpmat_owner; PostgreSQL 18.
-- Depende de migraciones 001-003. Aun NO verificada en la instancia Mac del usuario.
-- Sin DROP, TRUNCATE, DELETE ni datos ficticios. Preserva 24 tablas / 176 columnas / 42 FK.
-- Política explícita de v2: solo asignaciones 'asignada' o 'confirmada' ocupan cupo;
-- los intervalos son [inicio, fin), de modo que dos turnos contiguos son permitidos.
-- Pendiente: calendario semanal de disponibilidad, descansos, jornadas legales,
-- intercambios atomicos, privilegios por departamento y auditoria automatizada.
BEGIN;

CREATE FUNCTION sigpmat.fn_validar_asignacion_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $fn$
DECLARE
    v_estado_empleado text;
    v_cargo_empleado bigint;
    v_cargo_requerido bigint;
    v_especialidad_requerida bigint;
    v_cupos integer;
    v_turno_id bigint;
    v_inicio timestamptz;
    v_fin timestamptz;
    v_estado_turno text;
    v_cupos_ocupados bigint;
BEGIN
    IF NEW.estado NOT IN ('asignada', 'confirmada') THEN
        RETURN NEW;
    END IF;

    -- Preservar el rechazo por el indice UNIQUE parcial preexistente
    -- si se intenta insertar el mismo empleado en el mismo requerimiento.
    IF EXISTS (
        SELECT 1 FROM sigpmat.asignaciones_turno a
        WHERE a.id_requerimiento = NEW.id_requerimiento
          AND a.id_empleado = NEW.id_empleado
          AND a.estado IN ('asignada', 'confirmada')
          AND (TG_OP = 'INSERT' OR a.id_asignacion <> NEW.id_asignacion)
    ) THEN
        RETURN NEW;
    END IF;

    -- Los bloqueos ordenan las escrituras concurrentes del MISMO empleado
    -- o del MISMO requerimiento, bajo la modalidad usual READ COMMITTED.
    SELECT e.estado_vinculo, e.id_cargo
      INTO v_estado_empleado, v_cargo_empleado
      FROM sigpmat.empleados e
     WHERE e.id_empleado = NEW.id_empleado
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'SIGPMAT: empleado inexistente';
    END IF;

    SELECT r.id_cargo, r.id_especialidad, r.cupos_requeridos, r.id_turno
      INTO v_cargo_requerido, v_especialidad_requerida, v_cupos, v_turno_id
      FROM sigpmat.requerimientos_turno r
     WHERE r.id_requerimiento = NEW.id_requerimiento
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'SIGPMAT: requerimiento inexistente';
    END IF;

    SELECT t.inicio_at, t.fin_at, t.estado
      INTO v_inicio, v_fin, v_estado_turno
      FROM sigpmat.turnos t
     WHERE t.id_turno = v_turno_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'SIGPMAT: turno inexistente';
    END IF;

    IF v_estado_turno = 'cancelado' THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: no se asigna personal a un turno cancelado';
    END IF;
    IF v_estado_empleado <> 'activo' THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: empleado no activo';
    END IF;
    IF v_cargo_empleado <> v_cargo_requerido THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: cargo incompatible con el requerimiento';
    END IF;

    IF v_especialidad_requerida IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM sigpmat.empleado_especialidad ee
          JOIN sigpmat.especialidades sp ON sp.id_especialidad = ee.id_especialidad
         WHERE ee.id_empleado = NEW.id_empleado
           AND ee.id_especialidad = v_especialidad_requerida
           AND sp.activo
           AND ee.fecha_acreditacion <= v_inicio::date
           AND ee.vigente_desde <= v_inicio::date
           AND (ee.vigente_hasta IS NULL
                OR ee.vigente_hasta >= (v_fin - interval '1 microsecond')::date)
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: especialidad no acreditada o fuera de vigencia';
    END IF;

    SELECT count(*) INTO v_cupos_ocupados
      FROM sigpmat.asignaciones_turno a
     WHERE a.id_requerimiento = NEW.id_requerimiento
       AND a.estado IN ('asignada', 'confirmada')
       AND (TG_OP = 'INSERT' OR a.id_asignacion <> NEW.id_asignacion);
    IF v_cupos_ocupados >= v_cupos THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: cupos completos';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM sigpmat.asignaciones_turno a
          JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento = a.id_requerimiento
          JOIN sigpmat.turnos t ON t.id_turno = r.id_turno
         WHERE a.id_empleado = NEW.id_empleado
           AND a.estado IN ('asignada', 'confirmada')
           AND t.estado <> 'cancelado'
           AND (TG_OP = 'INSERT' OR a.id_asignacion <> NEW.id_asignacion)
           AND t.inicio_at < v_fin
           AND v_inicio < t.fin_at
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: turno superpuesto para el empleado';
    END IF;

    IF EXISTS (
        SELECT 1 FROM sigpmat.solicitudes_ausencia au
         WHERE au.id_empleado = NEW.id_empleado
           AND au.estado = 'aprobada'
           AND au.inicio_at < v_fin AND v_inicio < au.fin_at
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: ausencia aprobada incompatible con el turno';
    END IF;

    IF EXISTS (
        SELECT 1 FROM sigpmat.excepciones_disponibilidad ex
         WHERE ex.id_empleado = NEW.id_empleado
           AND ex.tipo = 'no_disponible'
           AND ex.inicio_at < v_fin AND v_inicio < ex.fin_at
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: excepcion de no disponibilidad';
    END IF;

    RETURN NEW;
END;
$fn$;

CREATE TRIGGER tg_06_validar_asignacion
BEFORE INSERT OR UPDATE OF id_empleado, id_requerimiento, estado
ON sigpmat.asignaciones_turno
FOR EACH ROW
EXECUTE FUNCTION sigpmat.fn_validar_asignacion_v2();

CREATE FUNCTION sigpmat.fn_validar_ausencia_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $fn$
BEGIN
    IF NEW.estado <> 'aprobada' THEN
        RETURN NEW;
    END IF;

    PERFORM 1 FROM sigpmat.empleados e
     WHERE e.id_empleado = NEW.id_empleado FOR UPDATE;

    IF EXISTS (
        SELECT 1 FROM sigpmat.asignaciones_turno a
          JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento = a.id_requerimiento
          JOIN sigpmat.turnos t ON t.id_turno = r.id_turno
         WHERE a.id_empleado = NEW.id_empleado
           AND a.estado IN ('asignada', 'confirmada')
           AND t.estado <> 'cancelado'
           AND t.inicio_at < NEW.fin_at
           AND NEW.inicio_at < t.fin_at
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: resolver los turnos antes de aprobar la ausencia';
    END IF;
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER tg_06_validar_ausencia
BEFORE INSERT OR UPDATE OF estado, id_empleado, inicio_at, fin_at
ON sigpmat.solicitudes_ausencia
FOR EACH ROW
EXECUTE FUNCTION sigpmat.fn_validar_ausencia_v2();

CREATE FUNCTION sigpmat.fn_validar_excepcion_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $fn$
BEGIN
    IF NEW.tipo <> 'no_disponible' THEN
        RETURN NEW;
    END IF;

    PERFORM 1 FROM sigpmat.empleados e
     WHERE e.id_empleado = NEW.id_empleado FOR UPDATE;

    IF EXISTS (
        SELECT 1 FROM sigpmat.asignaciones_turno a
          JOIN sigpmat.requerimientos_turno r ON r.id_requerimiento = a.id_requerimiento
          JOIN sigpmat.turnos t ON t.id_turno = r.id_turno
         WHERE a.id_empleado = NEW.id_empleado
           AND a.estado IN ('asignada', 'confirmada')
           AND t.estado <> 'cancelado'
           AND t.inicio_at < NEW.fin_at
           AND NEW.inicio_at < t.fin_at
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: resolver los turnos antes de declarar no disponibilidad';
    END IF;
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER tg_06_validar_excepcion
BEFORE INSERT OR UPDATE OF tipo, id_empleado, inicio_at, fin_at
ON sigpmat.excepciones_disponibilidad
FOR EACH ROW
EXECUTE FUNCTION sigpmat.fn_validar_excepcion_v2();

CREATE FUNCTION sigpmat.fn_validar_requerimiento_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $fn$
DECLARE
    v_activas bigint;
BEGIN
    SELECT count(*) INTO v_activas
      FROM sigpmat.asignaciones_turno a
     WHERE a.id_requerimiento = OLD.id_requerimiento
       AND a.estado IN ('asignada', 'confirmada');

    IF v_activas > 0 AND (
        NEW.id_turno IS DISTINCT FROM OLD.id_turno OR
        NEW.id_cargo IS DISTINCT FROM OLD.id_cargo OR
        NEW.id_especialidad IS DISTINCT FROM OLD.id_especialidad
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: cancelar asignaciones antes de cambiar el perfil o turno';
    END IF;
    IF v_activas > NEW.cupos_requeridos THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: cupo menor que asignaciones activas';
    END IF;
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER tg_06_validar_requerimiento
BEFORE UPDATE OF id_turno, id_cargo, id_especialidad, cupos_requeridos
ON sigpmat.requerimientos_turno
FOR EACH ROW
EXECUTE FUNCTION sigpmat.fn_validar_requerimiento_v2();

CREATE FUNCTION sigpmat.fn_validar_turno_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $fn$
BEGIN
    IF (
        NEW.inicio_at IS DISTINCT FROM OLD.inicio_at OR
        NEW.fin_at IS DISTINCT FROM OLD.fin_at OR
        NEW.id_departamento IS DISTINCT FROM OLD.id_departamento OR
        (NEW.estado = 'cancelado' AND OLD.estado <> 'cancelado')
    ) AND EXISTS (
        SELECT 1
          FROM sigpmat.requerimientos_turno r
          JOIN sigpmat.asignaciones_turno a ON a.id_requerimiento = r.id_requerimiento
         WHERE r.id_turno = OLD.id_turno
           AND a.estado IN ('asignada', 'confirmada')
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: cancelar o reprogramar asignaciones antes de cambiar/cancelar el turno';
    END IF;
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER tg_06_validar_turno
BEFORE UPDATE OF inicio_at, fin_at, id_departamento, estado
ON sigpmat.turnos
FOR EACH ROW
EXECUTE FUNCTION sigpmat.fn_validar_turno_v2();

CREATE FUNCTION sigpmat.fn_validar_empleado_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $fn$
BEGIN
    IF (
        NEW.id_cargo IS DISTINCT FROM OLD.id_cargo OR
        (NEW.estado_vinculo <> 'activo' AND OLD.estado_vinculo = 'activo')
    ) AND EXISTS (
        SELECT 1 FROM sigpmat.asignaciones_turno a
         WHERE a.id_empleado = OLD.id_empleado
           AND a.estado IN ('asignada', 'confirmada')
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SIGPMAT: resolver asignaciones antes de cambiar cargo o desactivar empleado';
    END IF;
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER tg_06_validar_empleado
BEFORE UPDATE OF id_cargo, estado_vinculo
ON sigpmat.empleados
FOR EACH ROW
EXECUTE FUNCTION sigpmat.fn_validar_empleado_v2();

COMMENT ON FUNCTION sigpmat.fn_validar_asignacion_v2() IS
'V2: estados activos, cupos, cargo, especialidad, solape, ausencia y excepciones. Empleado y requerimiento se bloquean durante la validación.';
COMMENT ON FUNCTION sigpmat.fn_validar_ausencia_v2() IS
'V2: ausencia aprobada requiere resolver previamente asignaciones en conflicto.';
COMMENT ON FUNCTION sigpmat.fn_validar_excepcion_v2() IS
'V2: excepción no_disponible requiere resolver previamente asignaciones en conflicto.';
COMMENT ON FUNCTION sigpmat.fn_validar_requerimiento_v2() IS
'V2: protege cupos y cambios de perfil cuando existen asignaciones activas.';
COMMENT ON FUNCTION sigpmat.fn_validar_turno_v2() IS
'V2: impide modificar fecha/área o cancelar turnos con asignaciones activas.';
COMMENT ON FUNCTION sigpmat.fn_validar_empleado_v2() IS
'V2: impide cambios de cargo o desactivación del empleado con asignaciones activas.';

COMMIT;
