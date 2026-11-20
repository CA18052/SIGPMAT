-- SIGPMAT · Migración 19: registro de visitantes, reautenticación de un solo uso y auditoría.
-- Es aditiva: no borra cuentas ni registros del prototipo.
BEGIN;
INSERT INTO sigpmat.roles (codigo,nombre,descripcion,activo)
SELECT 'VISITANTE_LECTURA','Visitante de lectura',
       'Consulta departamentos, personal no sensible y turnos sin permiso de modificación.',TRUE
WHERE NOT EXISTS(SELECT 1 FROM sigpmat.roles WHERE codigo='VISITANTE_LECTURA');

CREATE TABLE IF NOT EXISTS sigpmat.confirmaciones_operacion (
  token_hash CHAR(64) PRIMARY KEY,
  id_usuario BIGINT NOT NULL REFERENCES sigpmat.usuarios(id_usuario),
  metodo VARCHAR(10) NOT NULL,
  ruta VARCHAR(250) NOT NULL,
  creado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_at TIMESTAMPTZ NOT NULL,
  usado_at TIMESTAMPTZ,
  CONSTRAINT ck_confirmacion_metodo CHECK (metodo IN ('POST','PATCH','PUT','DELETE')),
  CONSTRAINT ck_confirmacion_plazo CHECK (expira_at>creado_at)
);
CREATE INDEX IF NOT EXISTS ix_confirmaciones_usuario ON sigpmat.confirmaciones_operacion(id_usuario,expira_at);

CREATE TABLE IF NOT EXISTS sigpmat.auditoria_seguridad (
  id_auditoria BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_usuario BIGINT REFERENCES sigpmat.usuarios(id_usuario),
  nombre_usuario VARCHAR(50),
  metodo VARCHAR(10) NOT NULL,
  ruta VARCHAR(250) NOT NULL,
  resultado VARCHAR(15) NOT NULL,
  codigo_http INTEGER NOT NULL,
  campos_afectados TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  request_id VARCHAR(120),
  CONSTRAINT ck_auditoria_seguridad_resultado CHECK (resultado IN ('EXITOSO','RECHAZADO','ERROR'))
);
CREATE INDEX IF NOT EXISTS ix_auditoria_seguridad_fecha ON sigpmat.auditoria_seguridad(fecha_at DESC,id_auditoria DESC);
CREATE INDEX IF NOT EXISTS ix_auditoria_seguridad_usuario ON sigpmat.auditoria_seguridad(id_usuario,fecha_at DESC);

GRANT SELECT ON sigpmat.roles TO sigpmat_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON sigpmat.confirmaciones_operacion TO sigpmat_app;
GRANT SELECT,INSERT ON sigpmat.auditoria_seguridad TO sigpmat_app;
GRANT INSERT ON sigpmat.usuario_roles TO sigpmat_app;
GRANT INSERT ON sigpmat.usuarios TO sigpmat_app;
COMMIT;

SELECT codigo,nombre FROM sigpmat.roles WHERE codigo='VISITANTE_LECTURA';
