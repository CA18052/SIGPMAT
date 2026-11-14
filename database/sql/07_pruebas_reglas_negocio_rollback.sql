-- SIGPMAT | 007 | Pruebas de las reglas operativas v2.0
-- Ejecutar como sigpmat_owner despues de 006. No ejecuta COMMIT.
-- Datos QA transitorios. ROLLBACK final (las secuencias pueden avanzar).
\echo '========== INICIANDO 12 PRUEBAS OPERATIVAS =========='
BEGIN;
DO $pruebas$
DECLARE
    v_cargo_a bigint;
    v_cargo_b bigint;
    v_especialidad bigint;
    v_emp1 bigint;
    v_emp2 bigint;
    v_emp3 bigint;
    v_emp4 bigint;
    v_departamento bigint;
    v_usuario bigint;
    v_turno1 bigint;
    v_turno2 bigint;
    v_turno3 bigint;
    v_turno4 bigint;
    v_turno5 bigint;
    v_req1 bigint;
    v_req2 bigint;
    v_req3 bigint;
    v_req4 bigint;
    v_req5 bigint;
    v_ausencia bigint;
BEGIN
    -- Fixture: nombres exclusivos; todo se revierte antes de finalizar.
    INSERT INTO sigpmat.cargos(nombre,categoria)
       VALUES ('QA6 Cargo A','medico') RETURNING id_cargo INTO v_cargo_a;
    INSERT INTO sigpmat.cargos(nombre,categoria)
       VALUES ('QA6 Cargo B','enfermeria') RETURNING id_cargo INTO v_cargo_b;
    INSERT INTO sigpmat.especialidades(codigo,nombre)
       VALUES ('QA6-ESP','QA6 Especialidad temporal') RETURNING id_especialidad INTO v_especialidad;
    INSERT INTO sigpmat.empleados(codigo_empleado,nombres,apellidos,id_cargo,estado_vinculo)
       VALUES ('QA6-E1','Empleado','Uno',v_cargo_a,'activo') RETURNING id_empleado INTO v_emp1;
    INSERT INTO sigpmat.empleados(codigo_empleado,nombres,apellidos,id_cargo,estado_vinculo)
       VALUES ('QA6-E2','Empleado','Dos',v_cargo_a,'activo') RETURNING id_empleado INTO v_emp2;
    INSERT INTO sigpmat.empleados(codigo_empleado,nombres,apellidos,id_cargo,estado_vinculo)
       VALUES ('QA6-E3','Empleado','Tres',v_cargo_b,'activo') RETURNING id_empleado INTO v_emp3;
    INSERT INTO sigpmat.empleados(codigo_empleado,nombres,apellidos,id_cargo,estado_vinculo)
       VALUES ('QA6-E4','Empleado','Cuatro',v_cargo_a,'inactivo') RETURNING id_empleado INTO v_emp4;
    INSERT INTO sigpmat.departamentos(codigo,nombre)
       VALUES ('QA6-D','QA6 Departamento') RETURNING id_departamento INTO v_departamento;
    INSERT INTO sigpmat.usuarios(nombre_usuario,correo_institucional,contrasena_hash,estado)
       VALUES ('qa6-temporal','qa6@example.invalid','NO_ES_PASSWORD_REAL','activa')
       RETURNING id_usuario INTO v_usuario;

    INSERT INTO sigpmat.turnos(id_departamento,tipo_turno,inicio_at,fin_at,creado_por)
       VALUES (v_departamento,'diurno','2026-11-02 08:00-06','2026-11-02 16:00-06',v_usuario)
       RETURNING id_turno INTO v_turno1;
    INSERT INTO sigpmat.turnos(id_departamento,tipo_turno,inicio_at,fin_at,creado_por)
       VALUES (v_departamento,'mixto','2026-11-02 12:00-06','2026-11-02 20:00-06',v_usuario)
       RETURNING id_turno INTO v_turno2;
    INSERT INTO sigpmat.turnos(id_departamento,tipo_turno,inicio_at,fin_at,creado_por)
       VALUES (v_departamento,'mixto','2026-11-02 16:00-06','2026-11-02 20:00-06',v_usuario)
       RETURNING id_turno INTO v_turno3;
    INSERT INTO sigpmat.turnos(id_departamento,tipo_turno,inicio_at,fin_at,creado_por)
       VALUES (v_departamento,'diurno','2026-11-03 08:00-06','2026-11-03 16:00-06',v_usuario)
       RETURNING id_turno INTO v_turno4;
    INSERT INTO sigpmat.turnos(id_departamento,tipo_turno,inicio_at,fin_at,creado_por)
       VALUES (v_departamento,'diurno','2026-11-04 08:00-06','2026-11-04 16:00-06',v_usuario)
       RETURNING id_turno INTO v_turno5;

    INSERT INTO sigpmat.requerimientos_turno(id_turno,id_cargo,cupos_requeridos)
       VALUES (v_turno1,v_cargo_a,1) RETURNING id_requerimiento INTO v_req1;
    INSERT INTO sigpmat.requerimientos_turno(id_turno,id_cargo,cupos_requeridos)
       VALUES (v_turno2,v_cargo_a,2) RETURNING id_requerimiento INTO v_req2;
    INSERT INTO sigpmat.requerimientos_turno(id_turno,id_cargo,cupos_requeridos)
       VALUES (v_turno3,v_cargo_a,2) RETURNING id_requerimiento INTO v_req3;
    INSERT INTO sigpmat.requerimientos_turno(id_turno,id_cargo,id_especialidad,cupos_requeridos)
       VALUES (v_turno4,v_cargo_a,v_especialidad,2) RETURNING id_requerimiento INTO v_req4;
    INSERT INTO sigpmat.requerimientos_turno(id_turno,id_cargo,cupos_requeridos)
       VALUES (v_turno5,v_cargo_a,2) RETURNING id_requerimiento INTO v_req5;

    INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
       VALUES (v_req1,v_emp1,'manual','asignada',v_usuario);

    -- 01: mismo empleado, diferente turno, intervalos cruzados.
    BEGIN
        INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
            VALUES (v_req2,v_emp1,'manual','asignada',v_usuario);
        RAISE EXCEPTION 'FALLO 01: solape aceptado';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 01: turnos superpuestos rechazados';
    END;

    -- 02: requerido 1, otro empleado no puede llenar segundo cupo.
    BEGIN
        INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
            VALUES (v_req1,v_emp2,'manual','asignada',v_usuario);
        RAISE EXCEPTION 'FALLO 02: sobrecupo aceptado';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 02: sobrecupo rechazado';
    END;

    -- 03: empleado con cargo diferente.
    BEGIN
        INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
            VALUES (v_req2,v_emp3,'manual','asignada',v_usuario);
        RAISE EXCEPTION 'FALLO 03: cargo incompatible aceptado';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 03: cargo incompatible rechazado';
    END;

    -- 04: empleado inactivo.
    BEGIN
        INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
            VALUES (v_req2,v_emp4,'manual','asignada',v_usuario);
        RAISE EXCEPTION 'FALLO 04: empleado inactivo aceptado';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 04: empleado inactivo rechazado';
    END;

    -- 05: especialidad requerida, no acreditada.
    BEGIN
        INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
            VALUES (v_req4,v_emp2,'manual','asignada',v_usuario);
        RAISE EXCEPTION 'FALLO 05: especialidad no acreditada aceptada';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 05: especialidad no acreditada rechazada';
    END;

    -- 06: acreditación suficiente permite asignar.
    INSERT INTO sigpmat.empleado_especialidad(id_empleado,id_especialidad,fecha_acreditacion,vigente_desde)
       VALUES (v_emp2,v_especialidad,'2026-01-01','2026-01-01');
    INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
       VALUES (v_req4,v_emp2,'manual','asignada',v_usuario);
    RAISE NOTICE 'OK 06: acreditacion vigente permite asignacion';

    -- 07: no aprobar ausencia si ya existe asignacion solapada.
    INSERT INTO sigpmat.solicitudes_ausencia(id_empleado,tipo,inicio_at,fin_at,estado)
       VALUES (v_emp2,'permiso','2026-11-03 09:00-06','2026-11-03 12:00-06','pendiente')
       RETURNING id_ausencia INTO v_ausencia;
    BEGIN
        UPDATE sigpmat.solicitudes_ausencia SET estado = 'aprobada'
         WHERE id_ausencia = v_ausencia;
        RAISE EXCEPTION 'FALLO 07: ausencia sobre turno aprobada';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 07: aprobacion de ausencia incompatible rechazada';
    END;

    -- 08: ausencia ya aprobada impide NUEVA asignacion.
    INSERT INTO sigpmat.solicitudes_ausencia(id_empleado,tipo,inicio_at,fin_at,estado)
       VALUES (v_emp1,'permiso','2026-11-04 10:00-06','2026-11-04 12:00-06','aprobada');
    BEGIN
        INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
           VALUES (v_req5,v_emp1,'manual','asignada',v_usuario);
        RAISE EXCEPTION 'FALLO 08: turno durante ausencia aceptado';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 08: asignacion durante ausencia aprobada rechazada';
    END;

    -- 09: no se puede declarar no disponibilidad retroactiva sobre asignacion.
    BEGIN
        INSERT INTO sigpmat.excepciones_disponibilidad(id_empleado,inicio_at,fin_at,tipo)
            VALUES (v_emp2,'2026-11-03 09:00-06','2026-11-03 11:00-06','no_disponible');
        RAISE EXCEPTION 'FALLO 09: excepcion sobre turno aceptada';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 09: excepcion incompatible rechazada';
    END;

    -- 10: excepcion previamente declarada impide una nueva asignacion.
    INSERT INTO sigpmat.excepciones_disponibilidad(id_empleado,inicio_at,fin_at,tipo)
        VALUES (v_emp2,'2026-11-04 10:00-06','2026-11-04 12:00-06','no_disponible');
    BEGIN
        INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
            VALUES (v_req5,v_emp2,'manual','asignada',v_usuario);
        RAISE EXCEPTION 'FALLO 10: turno pese a excepcion aceptado';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 10: asignacion incompatible con excepcion rechazada';
    END;

    -- 11: impedir cambios del turno con una asignacion activa.
    BEGIN
        UPDATE sigpmat.turnos SET inicio_at = TIMESTAMPTZ '2026-11-02 07:00-06'
         WHERE id_turno = v_turno1;
        RAISE EXCEPTION 'FALLO 11: cambio de horario con asignados aceptado';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 11: modificacion de turno ocupado rechazada';
    END;

    -- 12: los intervalos contiguos [inicio,fin) no se solapan.
    INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
        VALUES (v_req3,v_emp1,'manual','asignada',v_usuario);
    RAISE NOTICE 'OK 12: turno contiguo 16:00-20:00 permitido';

    RAISE NOTICE 'PRUEBAS OPERATIVAS 12/12 COMPLETADAS; ROLLBACK INMINENTE.';
END;
$pruebas$;
ROLLBACK;
\echo '========== V2: PRUEBAS TERMINADAS SIN FILAS QA PERSISTENTES =========='
