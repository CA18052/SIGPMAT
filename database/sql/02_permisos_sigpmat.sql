-- SIGPMAT | Migracion 002 | Accesos del backend
-- Ejecutar como sigpmat_owner en sigpmat_dev, despues de 001.
-- NO se concede CREATE de schema, SUPERUSER, ni DELETE general al backend.
BEGIN;
GRANT USAGE ON SCHEMA sigpmat TO sigpmat_app;
GRANT SELECT ON ALL TABLES IN SCHEMA sigpmat TO sigpmat_app;
GRANT INSERT, UPDATE ON TABLE sigpmat.usuarios,
    sigpmat.usuario_roles,
    sigpmat.cargos,
    sigpmat.empleados,
    sigpmat.especialidades,
    sigpmat.empleado_especialidad,
    sigpmat.departamentos,
    sigpmat.empleado_departamento,
    sigpmat.disponibilidades,
    sigpmat.excepciones_disponibilidad,
    sigpmat.solicitudes_ausencia,
    sigpmat.politicas_asignacion,
    sigpmat.turnos,
    sigpmat.requerimientos_turno,
    sigpmat.ejecuciones_asignacion,
    sigpmat.propuestas_asignacion,
    sigpmat.asignaciones_turno,
    sigpmat.solicitudes_cambio,
    sigpmat.emergencias,
    sigpmat.registros_asistencia,
    sigpmat.notificaciones TO sigpmat_app;
GRANT INSERT ON TABLE sigpmat.auditoria, sigpmat.reportes_generados TO sigpmat_app;
-- La asignacion/revocacion de roles requiere DELETE de la relacion (auditar desde la capa de servicio).
GRANT DELETE ON TABLE sigpmat.usuario_roles TO sigpmat_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sigpmat TO sigpmat_app;
-- Los nuevos objetos futuros solo reciben lectura hasta que una migracion otorgue permisos especificos.
ALTER DEFAULT PRIVILEGES FOR ROLE sigpmat_owner IN SCHEMA sigpmat GRANT SELECT ON TABLES TO sigpmat_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sigpmat_owner IN SCHEMA sigpmat GRANT USAGE, SELECT ON SEQUENCES TO sigpmat_app;
COMMIT;
