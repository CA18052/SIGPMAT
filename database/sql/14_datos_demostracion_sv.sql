-- SIGPMAT | Demostración académica con datos 100% sintéticos, El Salvador
-- Los DUI, contactos y registros profesionales son ilustrativos y NO pertenecen a personas verificadas.
-- REQUISITOS: ejecutar primero 13_perfiles_fotografias.sql y conservar admin.demo / jefe.demo.
-- Es idempotente para el mismo día de ejecución. No elimina personas, no altera contraseñas ni roles.
-- Previamente crear una rama/respaldo de Neon; probar la carga en una rama de ensayo.
BEGIN;
DO $carga$
DECLARE
 v_admin BIGINT;
BEGIN
 IF current_database() <> 'neondb' THEN
   RAISE EXCEPTION 'La carga solo está autorizada para la base neondb de demostración';
 END IF;
 SELECT id_usuario INTO v_admin FROM sigpmat.usuarios WHERE nombre_usuario='admin.demo' AND estado='activa';
 IF v_admin IS NULL THEN RAISE EXCEPTION 'Falta la cuenta admin.demo; no se modifica nada'; END IF;

 -- Mantener las claves existentes, pero emplear nombres institucionales realistas.
 UPDATE sigpmat.cargos SET nombre='Médico general'
 WHERE nombre='Médico general (demostración)'
 AND NOT EXISTS (SELECT 1 FROM sigpmat.cargos WHERE nombre='Médico general');
 UPDATE sigpmat.cargos SET nombre='Profesional de enfermería'
 WHERE nombre='Enfermería (demostración)'
 AND NOT EXISTS (SELECT 1 FROM sigpmat.cargos WHERE nombre='Profesional de enfermería');
 UPDATE sigpmat.cargos SET nombre='Médico especialista'
 WHERE nombre='Médico especialista (demostración)'
 AND NOT EXISTS (SELECT 1 FROM sigpmat.cargos WHERE nombre='Médico especialista');
 INSERT INTO sigpmat.cargos(nombre,categoria,activo) VALUES
   ('Médico general','medico',TRUE),
   ('Profesional de enfermería','enfermeria',TRUE),
   ('Médico especialista','medico',TRUE),
   ('Auxiliar de enfermería','enfermeria',TRUE),
   ('Médico residente','medico',TRUE),
   ('Técnico en radiología','apoyo',TRUE),
   ('Personal administrativo','apoyo',TRUE)
 ON CONFLICT (nombre) DO NOTHING;

 INSERT INTO sigpmat.departamentos(codigo,nombre,ubicacion,activo)
 SELECT x.codigo,x.nombre,x.ubicacion,TRUE FROM (VALUES
    ('DEMO-MI','Medicina Interna','Torre A · nivel 2'),
    ('DEMO-URG','Emergencias','Edificio principal · planta baja'),
    ('DEMO-PED','Pediatría','Torre B · nivel 1'),
    ('DEMO-CIR','Cirugía General','Torre A · nivel 3'),
    ('DEMO-UCI','Unidad de Cuidados Intensivos','Torre A · nivel 4'),
    ('DEMO-GIN','Ginecología y Obstetricia','Torre B · nivel 2'),
    ('DEMO-CAR','Cardiología','Torre A · nivel 5'),
    ('DEMO-RAD','Diagnóstico por Imágenes','Edificio C · nivel 1')
 ) AS x(codigo,nombre,ubicacion)
 ON CONFLICT (codigo) DO UPDATE SET ubicacion=EXCLUDED.ubicacion
 WHERE sigpmat.departamentos.codigo LIKE 'DEMO-%';

 INSERT INTO sigpmat.especialidades(codigo,nombre,descripcion,activo)
 SELECT x.codigo,x.nombre,'Catálogo ficticio SIGPMAT, no acredita profesionalmente',TRUE FROM (VALUES
    ('DEMO-ESP-MI','Medicina interna'),
    ('DEMO-ESP-URG','Medicina de emergencias'),
    ('DEMO-ESP-PED','Pediatría'),
    ('DEMO-ESP-CIR','Cirugía general'),
    ('DEMO-ESP-UCI','Medicina intensiva'),
    ('DEMO-ESP-GIN','Ginecología y obstetricia'),
    ('DEMO-ESP-CAR','Cardiología'),
    ('DEMO-ESP-RAD','Radiología e imágenes diagnósticas'),
    ('DEMO-ESP-ANE','Anestesiología'),
    ('DEMO-ESP-MF','Medicina familiar')
 ) AS x(codigo,nombre)
 ON CONFLICT (codigo) DO UPDATE SET nombre=EXCLUDED.nombre, activo=TRUE
 WHERE sigpmat.especialidades.codigo LIKE 'DEMO-%';

 -- Mantener el ID de cada uno de los 16 empleados de prueba existentes:
 -- jefe.demo continúa apuntando al mismo empleado de Medicina Interna.
 INSERT INTO sigpmat.empleados
   (codigo_empleado,nombres,apellidos,id_cargo,fecha_ingreso,estado_vinculo,dui,correo_contacto,telefono,numero_registro_profesional)
 SELECT x.codigo,x.nombres,x.apellidos,c.id_cargo,x.ingreso::DATE,x.estado,x.dui,x.correo,x.telefono,x.registro
 FROM (VALUES
    ('DEMO-MI-01','Sara Isabel','Varela Martínez','Médico general','DEMO-MI','SIM-MED-0001','activo','90000001-0','empleado01@sigpmat.example.invalid','0000-0001','2018-02-15'),
    ('DEMO-MI-02','Omar Alejandro','Pérez López','Profesional de enfermería','DEMO-MI','SIM-ENF-0002','activo','90000002-7','empleado02@sigpmat.example.invalid','0000-0002','2019-03-15'),
    ('DEMO-MI-03','Lucía Fernanda','Campos Rivera','Médico especialista','DEMO-MI','SIM-MED-0003','activo','90000003-4','empleado03@sigpmat.example.invalid','0000-0003','2020-04-15'),
    ('DEMO-MI-04','Raúl Antonio','Flores Campos','Profesional de enfermería','DEMO-MI','SIM-ENF-0004','activo','90000004-1','empleado04@sigpmat.example.invalid','0000-0004','2021-05-15'),
    ('DEMO-MI-05','María José','Menjívar Hernández','Médico general','DEMO-MI','SIM-MED-0005','activo','90000005-8','empleado05@sigpmat.example.invalid','0000-0005','2022-06-15'),
    ('DEMO-MI-06','Carlos Eduardo','Aguilar Cruz','Profesional de enfermería','DEMO-MI','SIM-ENF-0006','activo','90000006-5','empleado06@sigpmat.example.invalid','0000-0006','2023-07-15'),
    ('DEMO-MI-07','Gabriela Alejandra','Pineda Rosales','Médico general','DEMO-MI','SIM-MED-0007','activo','90000007-2','empleado07@sigpmat.example.invalid','0000-0007','2024-08-15'),
    ('DEMO-MI-08','José Mauricio','Méndez Arévalo','Auxiliar de enfermería','DEMO-MI',NULL,'activo','90000008-9','empleado08@sigpmat.example.invalid','0000-0008','2017-09-15'),
    ('DEMO-URG-01','Diego Ernesto','Méndez López','Médico general','DEMO-URG','SIM-MED-0009','activo','90000009-6','empleado09@sigpmat.example.invalid','0000-0009','2018-10-15'),
    ('DEMO-URG-02','Elena Patricia','Rivas Aguilar','Profesional de enfermería','DEMO-URG','SIM-ENF-0010','activo','90000010-3','empleado10@sigpmat.example.invalid','0000-0010','2019-11-15'),
    ('DEMO-URG-03','Víctor Manuel','Salinas Orellana','Médico especialista','DEMO-URG','SIM-MED-0011','activo','90000011-0','empleado11@sigpmat.example.invalid','0000-0011','2020-12-15'),
    ('DEMO-URG-04','Ana Sofía','Castillo Reyes','Profesional de enfermería','DEMO-URG','SIM-ENF-0012','activo','90000012-7','empleado12@sigpmat.example.invalid','0000-0012','2021-01-15'),
    ('DEMO-URG-05','Daniel Andrés','Rivera Portillo','Médico general','DEMO-URG','SIM-MED-0013','activo','90000013-4','empleado13@sigpmat.example.invalid','0000-0013','2022-02-15'),
    ('DEMO-URG-06','Beatriz Noemí','García Alfaro','Profesional de enfermería','DEMO-URG','SIM-ENF-0014','activo','90000014-1','empleado14@sigpmat.example.invalid','0000-0014','2023-03-15'),
    ('DEMO-URG-07','Ricardo Alberto','Vásquez Chávez','Médico general','DEMO-URG','SIM-MED-0015','activo','90000015-8','empleado15@sigpmat.example.invalid','0000-0015','2024-04-15'),
    ('DEMO-URG-08','Karla Elizabeth','Ortiz Flores','Auxiliar de enfermería','DEMO-URG',NULL,'activo','90000016-5','empleado16@sigpmat.example.invalid','0000-0016','2017-05-15'),
    ('DEMO-PED-01','Julia Beatriz','Ortega Díaz','Médico especialista','DEMO-PED','SIM-MED-0017','activo','90000017-2','empleado17@sigpmat.example.invalid','0000-0017','2018-06-15'),
    ('DEMO-PED-02','Bruno Ernesto','Herrera Castro','Profesional de enfermería','DEMO-PED','SIM-ENF-0018','activo','90000018-9','empleado18@sigpmat.example.invalid','0000-0018','2019-07-15'),
    ('DEMO-PED-03','Marta Elena','León Aguilar','Médico especialista','DEMO-PED','SIM-MED-0019','activo','90000019-6','empleado19@sigpmat.example.invalid','0000-0019','2020-08-15'),
    ('DEMO-PED-04','César Alejandro','Molina Reyes','Profesional de enfermería','DEMO-PED','SIM-ENF-0020','activo','90000020-3','empleado20@sigpmat.example.invalid','0000-0020','2021-09-15'),
    ('DEMO-PED-05','Valeria Elizabeth','Sánchez Aguilar','Médico general','DEMO-PED','SIM-MED-0021','activo','90000021-0','empleado21@sigpmat.example.invalid','0000-0021','2022-10-15'),
    ('DEMO-PED-06','José Roberto','Duarte Peraza','Profesional de enfermería','DEMO-PED','SIM-ENF-0022','activo','90000022-7','empleado22@sigpmat.example.invalid','0000-0022','2023-11-15'),
    ('DEMO-PED-07','Andrea Carolina','López Salazar','Médico general','DEMO-PED','SIM-MED-0023','activo','90000023-4','empleado23@sigpmat.example.invalid','0000-0023','2024-12-15'),
    ('DEMO-PED-08','Óscar Armando','Chávez Molina','Auxiliar de enfermería','DEMO-PED',NULL,'suspendido','90000024-1','empleado24@sigpmat.example.invalid','0000-0024','2017-01-15'),
    ('DEMO-CIR-01','Paula Mariana','Fuentes Hernández','Médico especialista','DEMO-CIR','SIM-MED-0025','activo','90000025-8','empleado25@sigpmat.example.invalid','0000-0025','2018-02-15'),
    ('DEMO-CIR-02','Renato Javier','Silva Romero','Profesional de enfermería','DEMO-CIR','SIM-ENF-0026','activo','90000026-5','empleado26@sigpmat.example.invalid','0000-0026','2019-03-15'),
    ('DEMO-CIR-03','Isabel Mercedes','Cruz Pineda','Médico especialista','DEMO-CIR','SIM-MED-0027','activo','90000027-2','empleado27@sigpmat.example.invalid','0000-0027','2020-04-15'),
    ('DEMO-CIR-04','Tomás Francisco','Pineda Álvarez','Profesional de enfermería','DEMO-CIR','SIM-ENF-0028','activo','90000028-9','empleado28@sigpmat.example.invalid','0000-0028','2021-05-15'),
    ('DEMO-CIR-05','Cristina Alejandra','Ávila Serrano','Médico general','DEMO-CIR','SIM-MED-0029','activo','90000029-6','empleado29@sigpmat.example.invalid','0000-0029','2022-06-15'),
    ('DEMO-CIR-06','Marco Antonio','Portillo García','Profesional de enfermería','DEMO-CIR','SIM-ENF-0030','activo','90000030-3','empleado30@sigpmat.example.invalid','0000-0030','2023-07-15'),
    ('DEMO-CIR-07','Diana Lucía','Flores Méndez','Médico general','DEMO-CIR','SIM-MED-0031','activo','90000031-0','empleado31@sigpmat.example.invalid','0000-0031','2024-08-15'),
    ('DEMO-CIR-08','Edwin Ricardo','Reyes Orellana','Auxiliar de enfermería','DEMO-CIR',NULL,'activo','90000032-7','empleado32@sigpmat.example.invalid','0000-0032','2017-09-15'),
    ('DEMO-UCI-01','Iván Daniel','Romero Mejía','Médico especialista','DEMO-UCI','SIM-MED-0033','activo','90000033-4','empleado33@sigpmat.example.invalid','0000-0033','2018-10-15'),
    ('DEMO-UCI-02','Carla Patricia','López Martínez','Profesional de enfermería','DEMO-UCI','SIM-ENF-0034','activo','90000034-1','empleado34@sigpmat.example.invalid','0000-0034','2019-11-15'),
    ('DEMO-UCI-03','Patricia Elena','Flores Cruz','Médico especialista','DEMO-UCI','SIM-MED-0035','activo','90000035-8','empleado35@sigpmat.example.invalid','0000-0035','2020-12-15'),
    ('DEMO-UCI-04','Miguel Ángel','Rivera Ponce','Profesional de enfermería','DEMO-UCI','SIM-ENF-0036','activo','90000036-5','empleado36@sigpmat.example.invalid','0000-0036','2021-01-15'),
    ('DEMO-UCI-05','Mónica Alejandra','García Miranda','Médico general','DEMO-UCI','SIM-MED-0037','activo','90000037-2','empleado37@sigpmat.example.invalid','0000-0037','2022-02-15'),
    ('DEMO-UCI-06','Luis Fernando','Herrera Molina','Profesional de enfermería','DEMO-UCI','SIM-ENF-0038','activo','90000038-9','empleado38@sigpmat.example.invalid','0000-0038','2023-03-15'),
    ('DEMO-UCI-07','Rocío Michelle','Sandoval Torres','Médico general','DEMO-UCI','SIM-MED-0039','activo','90000039-6','empleado39@sigpmat.example.invalid','0000-0039','2024-04-15'),
    ('DEMO-UCI-08','Héctor Eduardo','Rivas García','Auxiliar de enfermería','DEMO-UCI',NULL,'activo','90000040-3','empleado40@sigpmat.example.invalid','0000-0040','2017-05-15'),
    ('DEMO-GIN-01','Claudia Gabriela','Aguilar Sánchez','Médico especialista','DEMO-GIN','SIM-MED-0041','activo','90000041-0','empleado41@sigpmat.example.invalid','0000-0041','2018-06-15'),
    ('DEMO-GIN-02','Natalia Sofía','Molina Campos','Profesional de enfermería','DEMO-GIN','SIM-ENF-0042','activo','90000042-7','empleado42@sigpmat.example.invalid','0000-0042','2019-07-15'),
    ('DEMO-GIN-03','Alejandro José','Salinas Reyes','Médico especialista','DEMO-GIN','SIM-MED-0043','activo','90000043-4','empleado43@sigpmat.example.invalid','0000-0043','2020-08-15'),
    ('DEMO-GIN-04','Verónica Alejandra','Romero Flores','Profesional de enfermería','DEMO-GIN','SIM-ENF-0044','activo','90000044-1','empleado44@sigpmat.example.invalid','0000-0044','2021-09-15'),
    ('DEMO-GIN-05','Marta Cecilia','Hernández López','Médico general','DEMO-GIN','SIM-MED-0045','activo','90000045-8','empleado45@sigpmat.example.invalid','0000-0045','2022-10-15'),
    ('DEMO-GIN-06','Jorge Ernesto','Cruz Portillo','Profesional de enfermería','DEMO-GIN','SIM-ENF-0046','activo','90000046-5','empleado46@sigpmat.example.invalid','0000-0046','2023-11-15'),
    ('DEMO-GIN-07','Daniela Beatriz','Álvarez Pineda','Médico general','DEMO-GIN','SIM-MED-0047','inactivo','90000047-2','empleado47@sigpmat.example.invalid','0000-0047','2024-12-15'),
    ('DEMO-GIN-08','Ana María','Vásquez Rivera','Auxiliar de enfermería','DEMO-GIN',NULL,'activo','90000048-9','empleado48@sigpmat.example.invalid','0000-0048','2017-01-15'),
    ('DEMO-CAR-01','Fernando José','Pérez Rivas','Médico especialista','DEMO-CAR','SIM-MED-0049','activo','90000049-6','empleado49@sigpmat.example.invalid','0000-0049','2018-02-15'),
    ('DEMO-CAR-02','Patricia Guadalupe','Flores Serrano','Profesional de enfermería','DEMO-CAR','SIM-ENF-0050','activo','90000050-3','empleado50@sigpmat.example.invalid','0000-0050','2019-03-15'),
    ('DEMO-CAR-03','Mario Alberto','Mejía Castañeda','Médico especialista','DEMO-CAR','SIM-MED-0051','activo','90000051-0','empleado51@sigpmat.example.invalid','0000-0051','2020-04-15'),
    ('DEMO-CAR-04','Carolina Judith','Pineda Herrera','Profesional de enfermería','DEMO-CAR','SIM-ENF-0052','activo','90000052-7','empleado52@sigpmat.example.invalid','0000-0052','2021-05-15'),
    ('DEMO-CAR-05','Roberto Carlos','Torres Arévalo','Médico general','DEMO-CAR','SIM-MED-0053','activo','90000053-4','empleado53@sigpmat.example.invalid','0000-0053','2022-06-15'),
    ('DEMO-CAR-06','Gabriela Sofía','Rivera Medina','Profesional de enfermería','DEMO-CAR','SIM-ENF-0054','activo','90000054-1','empleado54@sigpmat.example.invalid','0000-0054','2023-07-15'),
    ('DEMO-CAR-07','Alfredo Daniel','López Cruz','Médico general','DEMO-CAR','SIM-MED-0055','inactivo','90000055-8','empleado55@sigpmat.example.invalid','0000-0055','2024-08-15'),
    ('DEMO-CAR-08','Marcela Alejandra','Díaz Molina','Auxiliar de enfermería','DEMO-CAR',NULL,'activo','90000056-5','empleado56@sigpmat.example.invalid','0000-0056','2017-09-15'),
    ('DEMO-RAD-01','Ernesto Alejandro','Martínez Gómez','Médico especialista','DEMO-RAD','SIM-MED-0057','activo','90000057-2','empleado57@sigpmat.example.invalid','0000-0057','2018-10-15'),
    ('DEMO-RAD-02','Gloria Margarita','Herrera Reyes','Profesional de enfermería','DEMO-RAD','SIM-ENF-0058','activo','90000058-9','empleado58@sigpmat.example.invalid','0000-0058','2019-11-15'),
    ('DEMO-RAD-03','Carlos Antonio','Cruz Alfaro','Médico especialista','DEMO-RAD','SIM-MED-0059','activo','90000059-6','empleado59@sigpmat.example.invalid','0000-0059','2020-12-15'),
    ('DEMO-RAD-04','Andrea Michelle','Linares Pineda','Profesional de enfermería','DEMO-RAD','SIM-ENF-0060','activo','90000060-3','empleado60@sigpmat.example.invalid','0000-0060','2021-01-15'),
    ('DEMO-RAD-05','Miguel Eduardo','Álvarez López','Médico general','DEMO-RAD','SIM-MED-0061','activo','90000061-0','empleado61@sigpmat.example.invalid','0000-0061','2022-02-15'),
    ('DEMO-RAD-06','María Alejandra','Romero Martínez','Profesional de enfermería','DEMO-RAD','SIM-ENF-0062','activo','90000062-7','empleado62@sigpmat.example.invalid','0000-0062','2023-03-15'),
    ('DEMO-RAD-07','David Ernesto','García Flores','Médico general','DEMO-RAD','SIM-MED-0063','activo','90000063-4','empleado63@sigpmat.example.invalid','0000-0063','2024-04-15'),
    ('DEMO-RAD-08','Paola Isabel','Pacheco Molina','Auxiliar de enfermería','DEMO-RAD',NULL,'suspendido','90000064-1','empleado64@sigpmat.example.invalid','0000-0064','2017-05-15')
 ) AS x(codigo,nombres,apellidos,cargo,departamento,registro,estado,dui,correo,telefono,ingreso)
 JOIN sigpmat.cargos c ON c.nombre=x.cargo
 ON CONFLICT (codigo_empleado) DO UPDATE
   SET nombres=EXCLUDED.nombres,apellidos=EXCLUDED.apellidos,id_cargo=EXCLUDED.id_cargo,
       fecha_ingreso=EXCLUDED.fecha_ingreso,estado_vinculo=EXCLUDED.estado_vinculo,
       dui=EXCLUDED.dui,correo_contacto=EXCLUDED.correo_contacto,telefono=EXCLUDED.telefono,
       numero_registro_profesional=EXCLUDED.numero_registro_profesional
 WHERE sigpmat.empleados.codigo_empleado LIKE 'DEMO-%';

 INSERT INTO sigpmat.empleado_departamento(id_empleado,id_departamento,fecha_inicio,es_jefe)
 SELECT e.id_empleado,d.id_departamento,DATE '2025-01-01',FALSE
 FROM (VALUES
    ('DEMO-MI-01','DEMO-MI'),
    ('DEMO-MI-02','DEMO-MI'),
    ('DEMO-MI-03','DEMO-MI'),
    ('DEMO-MI-04','DEMO-MI'),
    ('DEMO-MI-05','DEMO-MI'),
    ('DEMO-MI-06','DEMO-MI'),
    ('DEMO-MI-07','DEMO-MI'),
    ('DEMO-MI-08','DEMO-MI'),
    ('DEMO-URG-01','DEMO-URG'),
    ('DEMO-URG-02','DEMO-URG'),
    ('DEMO-URG-03','DEMO-URG'),
    ('DEMO-URG-04','DEMO-URG'),
    ('DEMO-URG-05','DEMO-URG'),
    ('DEMO-URG-06','DEMO-URG'),
    ('DEMO-URG-07','DEMO-URG'),
    ('DEMO-URG-08','DEMO-URG'),
    ('DEMO-PED-01','DEMO-PED'),
    ('DEMO-PED-02','DEMO-PED'),
    ('DEMO-PED-03','DEMO-PED'),
    ('DEMO-PED-04','DEMO-PED'),
    ('DEMO-PED-05','DEMO-PED'),
    ('DEMO-PED-06','DEMO-PED'),
    ('DEMO-PED-07','DEMO-PED'),
    ('DEMO-PED-08','DEMO-PED'),
    ('DEMO-CIR-01','DEMO-CIR'),
    ('DEMO-CIR-02','DEMO-CIR'),
    ('DEMO-CIR-03','DEMO-CIR'),
    ('DEMO-CIR-04','DEMO-CIR'),
    ('DEMO-CIR-05','DEMO-CIR'),
    ('DEMO-CIR-06','DEMO-CIR'),
    ('DEMO-CIR-07','DEMO-CIR'),
    ('DEMO-CIR-08','DEMO-CIR'),
    ('DEMO-UCI-01','DEMO-UCI'),
    ('DEMO-UCI-02','DEMO-UCI'),
    ('DEMO-UCI-03','DEMO-UCI'),
    ('DEMO-UCI-04','DEMO-UCI'),
    ('DEMO-UCI-05','DEMO-UCI'),
    ('DEMO-UCI-06','DEMO-UCI'),
    ('DEMO-UCI-07','DEMO-UCI'),
    ('DEMO-UCI-08','DEMO-UCI'),
    ('DEMO-GIN-01','DEMO-GIN'),
    ('DEMO-GIN-02','DEMO-GIN'),
    ('DEMO-GIN-03','DEMO-GIN'),
    ('DEMO-GIN-04','DEMO-GIN'),
    ('DEMO-GIN-05','DEMO-GIN'),
    ('DEMO-GIN-06','DEMO-GIN'),
    ('DEMO-GIN-07','DEMO-GIN'),
    ('DEMO-GIN-08','DEMO-GIN'),
    ('DEMO-CAR-01','DEMO-CAR'),
    ('DEMO-CAR-02','DEMO-CAR'),
    ('DEMO-CAR-03','DEMO-CAR'),
    ('DEMO-CAR-04','DEMO-CAR'),
    ('DEMO-CAR-05','DEMO-CAR'),
    ('DEMO-CAR-06','DEMO-CAR'),
    ('DEMO-CAR-07','DEMO-CAR'),
    ('DEMO-CAR-08','DEMO-CAR'),
    ('DEMO-RAD-01','DEMO-RAD'),
    ('DEMO-RAD-02','DEMO-RAD'),
    ('DEMO-RAD-03','DEMO-RAD'),
    ('DEMO-RAD-04','DEMO-RAD'),
    ('DEMO-RAD-05','DEMO-RAD'),
    ('DEMO-RAD-06','DEMO-RAD'),
    ('DEMO-RAD-07','DEMO-RAD'),
    ('DEMO-RAD-08','DEMO-RAD')
 ) AS x(codigo,departamento)
 JOIN sigpmat.empleados e ON e.codigo_empleado=x.codigo
 JOIN sigpmat.departamentos d ON d.codigo=x.departamento
 WHERE NOT EXISTS (SELECT 1 FROM sigpmat.empleado_departamento ed
   WHERE ed.id_empleado=e.id_empleado AND ed.id_departamento=d.id_departamento
      AND ed.fecha_inicio <= CURRENT_DATE AND (ed.fecha_fin IS NULL OR ed.fecha_fin>=CURRENT_DATE));

 -- Las áreas tienen una persona referente; solo Medicina Interna tiene cuenta de jefe.
 UPDATE sigpmat.empleado_departamento ed SET es_jefe=TRUE
 FROM sigpmat.empleados e
 WHERE ed.id_empleado=e.id_empleado AND e.codigo_empleado IN
 ('DEMO-MI-01','DEMO-URG-01','DEMO-PED-01','DEMO-CIR-01','DEMO-UCI-01','DEMO-GIN-01','DEMO-CAR-01','DEMO-RAD-01')
 AND ed.fecha_fin IS NULL AND ed.fecha_inicio<=CURRENT_DATE;

 -- Acreditar específicamente a médicos especialistas asociados a cada área.
 INSERT INTO sigpmat.empleado_especialidad
   (id_empleado,id_especialidad,fecha_acreditacion,vigente_desde,es_principal)
 SELECT e.id_empleado,s.id_especialidad,DATE '2023-01-01',DATE '2023-01-01',TRUE
 FROM (VALUES
    ('DEMO-MI-03','DEMO-ESP-MI'),
    ('DEMO-MI-01','DEMO-ESP-MI'),
    ('DEMO-URG-03','DEMO-ESP-URG'),
    ('DEMO-URG-01','DEMO-ESP-URG'),
    ('DEMO-PED-03','DEMO-ESP-PED'),
    ('DEMO-PED-01','DEMO-ESP-PED'),
    ('DEMO-CIR-03','DEMO-ESP-CIR'),
    ('DEMO-CIR-01','DEMO-ESP-CIR'),
    ('DEMO-UCI-03','DEMO-ESP-UCI'),
    ('DEMO-UCI-01','DEMO-ESP-UCI'),
    ('DEMO-GIN-03','DEMO-ESP-GIN'),
    ('DEMO-GIN-01','DEMO-ESP-GIN'),
    ('DEMO-CAR-03','DEMO-ESP-CAR'),
    ('DEMO-CAR-01','DEMO-ESP-CAR'),
    ('DEMO-RAD-03','DEMO-ESP-RAD'),
    ('DEMO-RAD-01','DEMO-ESP-RAD')
 ) AS x(codigo,especialidad)
 JOIN sigpmat.empleados e ON e.codigo_empleado=x.codigo
 JOIN sigpmat.cargos c ON c.id_cargo=e.id_cargo AND c.nombre='Médico especialista'
 JOIN sigpmat.especialidades s ON s.codigo=x.especialidad
 WHERE NOT EXISTS (SELECT 1 FROM sigpmat.empleado_especialidad ee WHERE ee.id_empleado=e.id_empleado AND ee.id_especialidad=s.id_especialidad);

 -- Tres turnos por departamento, anclados a los próximos tres días.
 INSERT INTO sigpmat.turnos(id_departamento,tipo_turno,inicio_at,fin_at,estado,creado_por)
 SELECT d.id_departamento, x.tipo, x.inicio,x.fin,'abierto',v_admin
 FROM (
   SELECT d.codigo, v.tipo,
     ((CURRENT_DATE+v.dia)::timestamp+v.hora_inicio) AT TIME ZONE 'America/El_Salvador' AS inicio,
     ((CURRENT_DATE+v.dia+v.fin_dia)::timestamp+v.hora_fin) AT TIME ZONE 'America/El_Salvador' AS fin
   FROM sigpmat.departamentos d
   CROSS JOIN (VALUES
     ('diurno',1,0,TIME '07:00',TIME '15:00'),
     ('mixto',2,0,TIME '15:00',TIME '23:00'),
     ('nocturno',3,1,TIME '23:00',TIME '07:00')
   ) AS v(tipo,dia,fin_dia,hora_inicio,hora_fin)
   WHERE d.codigo IN ('DEMO-MI','DEMO-URG','DEMO-PED','DEMO-CIR','DEMO-UCI','DEMO-GIN','DEMO-CAR','DEMO-RAD')
 ) AS x
 JOIN sigpmat.departamentos d ON d.codigo=x.codigo
 WHERE NOT EXISTS (SELECT 1 FROM sigpmat.turnos t
   WHERE t.id_departamento=d.id_departamento AND t.tipo_turno=x.tipo
      AND t.inicio_at=x.inicio AND t.fin_at=x.fin);

 INSERT INTO sigpmat.requerimientos_turno(id_turno,id_cargo,id_especialidad,cupos_requeridos,prioridad)
 SELECT t.id_turno,c.id_cargo,s.id_especialidad,2,
   CASE WHEN d.codigo IN ('DEMO-URG','DEMO-UCI') THEN 'alta' ELSE 'normal' END
 FROM sigpmat.turnos t JOIN sigpmat.departamentos d ON d.id_departamento=t.id_departamento
 JOIN (VALUES ('DEMO-MI','DEMO-ESP-MI'),
    ('DEMO-URG','DEMO-ESP-URG'),
    ('DEMO-PED','DEMO-ESP-PED'),
    ('DEMO-CIR','DEMO-ESP-CIR'),
    ('DEMO-UCI','DEMO-ESP-UCI'),
    ('DEMO-GIN','DEMO-ESP-GIN'),
    ('DEMO-CAR','DEMO-ESP-CAR'),
    ('DEMO-RAD','DEMO-ESP-RAD')) AS x(codigo,esp) ON x.codigo=d.codigo
 JOIN sigpmat.cargos c ON c.nombre=CASE t.tipo_turno
   WHEN 'diurno' THEN 'Médico especialista'
   WHEN 'mixto' THEN 'Profesional de enfermería'
   ELSE 'Médico general' END
 LEFT JOIN sigpmat.especialidades s ON s.codigo=x.esp AND t.tipo_turno='diurno'
 WHERE t.estado='abierto' AND t.inicio_at>=CURRENT_DATE
   AND NOT EXISTS (SELECT 1 FROM sigpmat.requerimientos_turno r WHERE r.id_turno=t.id_turno AND r.id_cargo=c.id_cargo AND r.id_especialidad IS NOT DISTINCT FROM s.id_especialidad);

 -- Coberturas de ejemplo: diurno 1/2, mixto 2/2, nocturno 1/2.
 INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
 SELECT r.id_requerimiento,e.id_empleado,'manual','asignada',v_admin
 FROM sigpmat.requerimientos_turno r
 JOIN sigpmat.turnos t ON t.id_turno=r.id_turno AND t.estado='abierto' AND t.inicio_at>=CURRENT_DATE
 JOIN sigpmat.departamentos d ON d.id_departamento=t.id_departamento
 JOIN sigpmat.empleados e ON
   e.codigo_empleado=d.codigo || CASE
      WHEN t.tipo_turno='diurno' THEN '-03'
      WHEN t.tipo_turno='mixto' THEN '-02'
      ELSE '-05' END
 WHERE d.codigo IN ('DEMO-MI','DEMO-URG','DEMO-PED','DEMO-CIR','DEMO-UCI','DEMO-GIN','DEMO-CAR','DEMO-RAD')
   AND e.estado_vinculo='activo'
   AND NOT EXISTS (SELECT 1 FROM sigpmat.asignaciones_turno a WHERE a.id_requerimiento=r.id_requerimiento AND a.id_empleado=e.id_empleado AND a.estado IN ('asignada','confirmada'));

 INSERT INTO sigpmat.asignaciones_turno(id_requerimiento,id_empleado,origen,estado,asignado_por)
 SELECT r.id_requerimiento,e.id_empleado,'manual','asignada',v_admin
 FROM sigpmat.requerimientos_turno r
 JOIN sigpmat.turnos t ON t.id_turno=r.id_turno AND t.tipo_turno='mixto' AND t.estado='abierto' AND t.inicio_at>=CURRENT_DATE
 JOIN sigpmat.departamentos d ON d.id_departamento=t.id_departamento
 JOIN sigpmat.empleados e ON e.codigo_empleado=d.codigo || '-04' AND e.estado_vinculo='activo'
 WHERE d.codigo IN ('DEMO-MI','DEMO-URG','DEMO-PED','DEMO-CIR','DEMO-UCI','DEMO-GIN','DEMO-CAR','DEMO-RAD')
   AND NOT EXISTS (SELECT 1 FROM sigpmat.asignaciones_turno a WHERE a.id_requerimiento=r.id_requerimiento AND a.id_empleado=e.id_empleado AND a.estado IN ('asignada','confirmada'));

 RAISE NOTICE 'SIGPMAT SV: 64 empleados ficticios, 8 departamentos y 24 turnos nuevos preparados';
END
$carga$;
COMMIT;

SELECT 'empleados_ficticios' AS indicador,COUNT(*) AS total FROM sigpmat.empleados WHERE codigo_empleado LIKE 'DEMO-%'
UNION ALL SELECT 'departamentos_demo',COUNT(*) FROM sigpmat.departamentos WHERE codigo LIKE 'DEMO-%'
UNION ALL SELECT 'especialidades_demo',COUNT(*) FROM sigpmat.especialidades WHERE codigo LIKE 'DEMO-%'
UNION ALL SELECT 'turnos_activos',COUNT(*) FROM sigpmat.turnos WHERE estado='abierto';
