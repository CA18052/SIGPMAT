-- Datos ficticios para el proyecto Neon exclusivo de SIGPMAT.
-- Ejecutar solo cuando se haya terminado de crear el esquema y conceder permisos.
-- Datos ficticios para la demostracion final de SIGPMAT.
-- Ejecutar UNICAMENTE en sigpmat_dev como sigpmat_app, despues del respaldo.
-- No elimina ni modifica registros existentes; puede repetirse sin duplicar los propios.
\set ON_ERROR_STOP on
BEGIN;
DO $demo$
BEGIN
  IF current_database() <> 'neondb' OR session_user <> 'sigpmat_app' THEN
    RAISE EXCEPTION 'La carga solo se permite en la base neondb como sigpmat_app';
  END IF;

  INSERT INTO sigpmat.cargos(nombre,categoria,activo)
  SELECT c.nombre,c.categoria,TRUE FROM (VALUES
    ('Médico general (demostración)', 'medico'),
    ('Enfermería (demostración)', 'enfermeria'),
    ('Médico especialista (demostración)', 'medico')
  ) AS c(nombre,categoria)
  WHERE TRUE
  ON CONFLICT (nombre) DO NOTHING;

  INSERT INTO sigpmat.departamentos(codigo,nombre,ubicacion,activo)
  SELECT d.codigo,d.nombre,d.ubicacion,TRUE FROM (VALUES
    ('DEMO-MI', 'Medicina Interna', 'Edificio A, nivel 2'),
    ('DEMO-URG', 'Urgencias', 'Planta baja'),
    ('DEMO-PED', 'Pediatría', 'Edificio B, nivel 1'),
    ('DEMO-CIR', 'Cirugía General', 'Edificio A, nivel 3')
  ) AS d(codigo,nombre,ubicacion)
  WHERE TRUE
  ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO sigpmat.especialidades(codigo,nombre,activo,descripcion)
  SELECT s.codigo,s.nombre,TRUE,'Datos ficticios para demostracion' FROM (VALUES
    ('DEMO-ESP-MI', 'Medicina interna (demostración)'),
    ('DEMO-ESP-URG', 'Medicina de emergencias (demostración)'),
    ('DEMO-ESP-PED', 'Pediatría (demostración)'),
    ('DEMO-ESP-CIR', 'Cirugía general (demostración)')
  ) AS s(codigo,nombre)
  WHERE TRUE
  ON CONFLICT (codigo) DO NOTHING;

  -- Evitar reutilizar un codigo de demo si ya existe con otro nombre.
  IF EXISTS (
    SELECT 1 FROM (VALUES
    ('DEMO-MI-01', 'Sara', 'Varela'),
    ('DEMO-MI-02', 'Omar', 'Pérez'),
    ('DEMO-MI-03', 'Lucía', 'Campos'),
    ('DEMO-MI-04', 'Raúl', 'Flores'),
    ('DEMO-URG-01', 'Diego', 'Méndez'),
    ('DEMO-URG-02', 'Elena', 'Rivas'),
    ('DEMO-URG-03', 'Víctor', 'Salinas'),
    ('DEMO-URG-04', 'Ana', 'Castillo'),
    ('DEMO-PED-01', 'Julia', 'Ortega'),
    ('DEMO-PED-02', 'Bruno', 'Herrera'),
    ('DEMO-PED-03', 'Marta', 'León'),
    ('DEMO-PED-04', 'César', 'Molina'),
    ('DEMO-CIR-01', 'Paula', 'Fuentes'),
    ('DEMO-CIR-02', 'Renato', 'Silva'),
    ('DEMO-CIR-03', 'Isabel', 'Cruz'),
    ('DEMO-CIR-04', 'Tomás', 'Pineda')
    ) AS x(codigo,nombres,apellidos)
    JOIN sigpmat.empleados e ON e.codigo_empleado=x.codigo
    WHERE e.nombres<>x.nombres OR e.apellidos<>x.apellidos
  ) THEN
    RAISE EXCEPTION 'Un codigo de demostracion ya pertenece a otro registro';
  END IF;

  INSERT INTO sigpmat.empleados
    (codigo_empleado,nombres,apellidos,id_cargo,fecha_ingreso,estado_vinculo)
  SELECT p.codigo,p.nombres,p.apellidos,c.id_cargo,CURRENT_DATE-60,'activo'
  FROM (VALUES
    ('DEMO-MI-01', 'Sara', 'Varela', 'Médico general (demostración)', 'DEMO-MI'),
    ('DEMO-MI-02', 'Omar', 'Pérez', 'Enfermería (demostración)', 'DEMO-MI'),
    ('DEMO-MI-03', 'Lucía', 'Campos', 'Médico especialista (demostración)', 'DEMO-MI'),
    ('DEMO-MI-04', 'Raúl', 'Flores', 'Enfermería (demostración)', 'DEMO-MI'),
    ('DEMO-URG-01', 'Diego', 'Méndez', 'Médico general (demostración)', 'DEMO-URG'),
    ('DEMO-URG-02', 'Elena', 'Rivas', 'Enfermería (demostración)', 'DEMO-URG'),
    ('DEMO-URG-03', 'Víctor', 'Salinas', 'Médico especialista (demostración)', 'DEMO-URG'),
    ('DEMO-URG-04', 'Ana', 'Castillo', 'Enfermería (demostración)', 'DEMO-URG'),
    ('DEMO-PED-01', 'Julia', 'Ortega', 'Médico especialista (demostración)', 'DEMO-PED'),
    ('DEMO-PED-02', 'Bruno', 'Herrera', 'Médico general (demostración)', 'DEMO-PED'),
    ('DEMO-PED-03', 'Marta', 'León', 'Enfermería (demostración)', 'DEMO-PED'),
    ('DEMO-PED-04', 'César', 'Molina', 'Enfermería (demostración)', 'DEMO-PED'),
    ('DEMO-CIR-01', 'Paula', 'Fuentes', 'Médico especialista (demostración)', 'DEMO-CIR'),
    ('DEMO-CIR-02', 'Renato', 'Silva', 'Médico general (demostración)', 'DEMO-CIR'),
    ('DEMO-CIR-03', 'Isabel', 'Cruz', 'Enfermería (demostración)', 'DEMO-CIR'),
    ('DEMO-CIR-04', 'Tomás', 'Pineda', 'Enfermería (demostración)', 'DEMO-CIR')
  ) AS p(codigo,nombres,apellidos,cargo,departamento)
  JOIN sigpmat.cargos c ON c.nombre=p.cargo AND c.activo=TRUE
  WHERE TRUE
  ON CONFLICT (codigo_empleado) DO NOTHING;

  -- Los vinculos actuales o futuros de empleados existentes se respetan.
  INSERT INTO sigpmat.empleado_departamento
    (id_empleado,id_departamento,fecha_inicio,es_jefe)
  SELECT e.id_empleado,d.id_departamento,CURRENT_DATE-60,FALSE
  FROM (VALUES
    ('DEMO-MI-01', 'DEMO-MI'),
    ('DEMO-MI-02', 'DEMO-MI'),
    ('DEMO-MI-03', 'DEMO-MI'),
    ('DEMO-MI-04', 'DEMO-MI'),
    ('DEMO-URG-01', 'DEMO-URG'),
    ('DEMO-URG-02', 'DEMO-URG'),
    ('DEMO-URG-03', 'DEMO-URG'),
    ('DEMO-URG-04', 'DEMO-URG'),
    ('DEMO-PED-01', 'DEMO-PED'),
    ('DEMO-PED-02', 'DEMO-PED'),
    ('DEMO-PED-03', 'DEMO-PED'),
    ('DEMO-PED-04', 'DEMO-PED'),
    ('DEMO-CIR-01', 'DEMO-CIR'),
    ('DEMO-CIR-02', 'DEMO-CIR'),
    ('DEMO-CIR-03', 'DEMO-CIR'),
    ('DEMO-CIR-04', 'DEMO-CIR')
  ) AS p(codigo_empleado,codigo_departamento)
  JOIN sigpmat.empleados e ON e.codigo_empleado=p.codigo_empleado
  JOIN sigpmat.departamentos d ON d.codigo=p.codigo_departamento
  WHERE NOT EXISTS (
    SELECT 1 FROM sigpmat.empleado_departamento ed WHERE ed.id_empleado=e.id_empleado
  );

  INSERT INTO sigpmat.empleado_especialidad
    (id_empleado,id_especialidad,fecha_acreditacion,vigente_desde,es_principal)
  SELECT e.id_empleado,s.id_especialidad,CURRENT_DATE-365,CURRENT_DATE-365,TRUE
  FROM (VALUES
    ('DEMO-MI-03', 'DEMO-ESP-MI'),
    ('DEMO-URG-03', 'DEMO-ESP-URG'),
    ('DEMO-PED-01', 'DEMO-ESP-PED'),
    ('DEMO-CIR-01', 'DEMO-ESP-CIR')
  ) AS p(codigo_empleado,codigo_especialidad)
  JOIN sigpmat.empleados e ON e.codigo_empleado=p.codigo_empleado
  JOIN sigpmat.especialidades s ON s.codigo=p.codigo_especialidad
  WHERE NOT EXISTS (
    SELECT 1 FROM sigpmat.empleado_especialidad ee
    WHERE ee.id_empleado=e.id_empleado AND ee.id_especialidad=s.id_especialidad
  );

  RAISE NOTICE 'Datos ficticios disponibles: 4 servicios, 3 cargos, 4 especialidades y 16 empleados.';
END;
$demo$;
COMMIT;

SELECT 'departamentos' AS tipo,COUNT(*) AS registros FROM sigpmat.departamentos WHERE codigo LIKE 'DEMO-%'
UNION ALL
SELECT 'empleados',COUNT(*) FROM sigpmat.empleados WHERE codigo_empleado LIKE 'DEMO-%'
UNION ALL
SELECT 'especialidades',COUNT(*) FROM sigpmat.especialidades WHERE codigo LIKE 'DEMO-%';
