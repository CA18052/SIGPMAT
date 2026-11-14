-- SIGPMAT | Migracion 003 | Roles basicos del sistema
-- Solo catalogo de roles, NO pacientes, empleados ni datos personales ficticios.
-- Ejecutar como sigpmat_owner en sigpmat_dev, despues de 002.
BEGIN;
INSERT INTO sigpmat.roles(codigo, nombre, descripcion, activo) VALUES
    ('ADMIN_GENERAL','Administrador general','Administra configuracion, personal, usuarios y trazabilidad.', TRUE),
    ('JEFE_AREA','Jefe de area','Gestiona turnos, solicitudes y cobertura de las areas autorizadas.', TRUE),
    ('PERSONAL_MEDICO','Personal medico','Consulta horarios y gestiona solicitudes propias.', TRUE);
COMMIT;
