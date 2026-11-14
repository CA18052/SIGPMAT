-- SIGPMAT | 005 | Pruebas de integridad transaccionales.
-- Ejecutar como sigpmat_owner DESPUES de migraciones 001-003 y diagnostico 004.
-- Todas las inserciones de ensayo quedan revertidas mediante ROLLBACK.
-- No prueban solapamientos ni reglas entre tablas: siguen pendientes.
\echo '========== INICIANDO 8 PRUEBAS DE INTEGRIDAD =========='
BEGIN;
DO $pruebas$
DECLARE
  v_cargo bigint;
  v_empleado bigint;
  v_departamento bigint;
  v_usuario bigint;
  v_turno bigint;
  v_requerimiento bigint;
BEGIN
  -- 01: El catalogo de roles debe tener codigos exclusivos.
  BEGIN
    INSERT INTO sigpmat.roles (codigo, nombre) VALUES ('ADMIN_GENERAL', 'Rol duplicado de prueba');
    RAISE EXCEPTION 'FALLO 01: acepto rol duplicado';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK 01: codigo de rol unico';
  END;

  -- 02: El empleado debe referir a un cargo valido.
  BEGIN
    INSERT INTO sigpmat.empleados (codigo_empleado, nombres, apellidos, id_cargo, estado_vinculo)
    VALUES ('QA-SIN-CARGO', 'Persona', 'Prueba', -987654321, 'activo');
    RAISE EXCEPTION 'FALLO 02: acepto cargo inexistente';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'OK 02: FK de empleado a cargo';
  END;

  -- Datos auxiliares validos: todos se revertiran al final.
  INSERT INTO sigpmat.cargos (nombre, categoria) VALUES ('QA Cargo temporal', 'medico') RETURNING id_cargo INTO v_cargo;
  INSERT INTO sigpmat.empleados(codigo_empleado, nombres, apellidos, id_cargo, estado_vinculo)
    VALUES ('QA-EMP-TEMP','Paciente-No','Personal Temporal',v_cargo,'activo') RETURNING id_empleado INTO v_empleado;
  INSERT INTO sigpmat.departamentos(codigo, nombre)
    VALUES ('QA-DEP','Departamento de prueba') RETURNING id_departamento INTO v_departamento;
  INSERT INTO sigpmat.usuarios(nombre_usuario,correo_institucional,contrasena_hash,estado)
    VALUES ('qa-temporal','qa-temporal@example.invalid','SOLO_TRANSACCION_ROLLBACK','activa') RETURNING id_usuario INTO v_usuario;

  -- 03: Dia semanal valido 1 a 7.
  BEGIN
    INSERT INTO sigpmat.disponibilidades(id_empleado,dia_semana,hora_inicio,hora_fin,tipo,vigente_desde)
      VALUES(v_empleado,8,'08:00','16:00','disponible',DATE '2026-11-01');
    RAISE EXCEPTION 'FALLO 03: acepto dia 8';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK 03: dia de semana entre 1 y 7';
  END;

  -- 04: Ausencia con periodo valido.
  BEGIN
    INSERT INTO sigpmat.solicitudes_ausencia(id_empleado,tipo,inicio_at,fin_at,estado)
      VALUES(v_empleado,'permiso',TIMESTAMPTZ '2026-11-02 19:00-06',TIMESTAMPTZ '2026-11-02 18:00-06','pendiente');
    RAISE EXCEPTION 'FALLO 04: acepto ausencia invertida';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK 04: tiempo de ausencia correcto';
  END;

  -- 05: Turno con fin mayor que inicio.
  BEGIN
    INSERT INTO sigpmat.turnos(id_departamento,tipo_turno,inicio_at,fin_at,creado_por)
      VALUES(v_departamento,'diurno',TIMESTAMPTZ '2026-11-02 19:00-06',TIMESTAMPTZ '2026-11-02 18:00-06',v_usuario);
    RAISE EXCEPTION 'FALLO 05: acepto turno invertido';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK 05: orden temporal de los turnos';
  END;

  INSERT INTO sigpmat.turnos(id_departamento,tipo_turno,inicio_at,fin_at,creado_por)
    VALUES(v_departamento,'diurno',TIMESTAMPTZ '2026-11-02 08:00-06',TIMESTAMPTZ '2026-11-02 16:00-06',v_usuario)
    RETURNING id_turno INTO v_turno;

  -- 06: cupos requeridos mayores que cero.
  BEGIN
    INSERT INTO sigpmat.requerimientos_turno(id_turno,id_cargo,cupos_requeridos)
      VALUES(v_turno,v_cargo,0);
    RAISE EXCEPTION 'FALLO 06: acepto cupos cero';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK 06: cupos positivos';
  END;

  INSERT INTO sigpmat.requerimientos_turno(id_turno,id_cargo,cupos_requeridos)
    VALUES(v_turno,v_cargo,1) RETURNING id_requerimiento INTO v_requerimiento;

  -- 07: perfil unico por turno, incluso con especialidad NULL.
  BEGIN
    INSERT INTO sigpmat.requerimientos_turno(id_turno,id_cargo,id_especialidad,cupos_requeridos)
      VALUES(v_turno,v_cargo,NULL,2);
    RAISE EXCEPTION 'FALLO 07: acepto perfil repetido';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK 07: unico perfil por turno';
  END;

  -- 08: Una asignacion activa no puede repetirse para el mismo empleado y requisito.
  INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
    VALUES(v_requerimiento,v_empleado,'manual','asignada',v_usuario);
  BEGIN
    INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
      VALUES(v_requerimiento,v_empleado,'manual','asignada',v_usuario);
    RAISE EXCEPTION 'FALLO 08: acepto asignacion duplicada';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK 08: no duplicar asignacion activa';
  END;
  RAISE NOTICE 'PRUEBAS 8/8 COMPLETADAS; ROLLBACK INMINENTE.';
END
$pruebas$;
ROLLBACK;
\echo '========== PRUEBAS FINALIZADAS SIN DATOS FICTICIOS PERSISTENTES =========='
