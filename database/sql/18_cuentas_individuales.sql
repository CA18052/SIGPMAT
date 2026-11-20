-- SIGPMAT | Migración 18 · Cuentas individuales y superadministración.
-- No elimina ni sustituye usuarios, contraseñas, roles ni sesiones guardadas.
-- Se aplica antes de desplegar el backend del Paquete 05.
BEGIN;
ALTER TABLE sigpmat.usuarios
  ADD COLUMN IF NOT EXISTS nombre_mostrado VARCHAR(120),
  ADD COLUMN IF NOT EXISTS tipo_cuenta VARCHAR(20) NOT NULL DEFAULT 'demo',
  ADD COLUMN IF NOT EXISTS es_superadministrador BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS debe_cambiar_contrasena BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sesion_version INTEGER NOT NULL DEFAULT 0;

DO $validacion$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_usuarios_tipo_cuenta'
      AND conrelid = 'sigpmat.usuarios'::regclass
  ) THEN
    ALTER TABLE sigpmat.usuarios
      ADD CONSTRAINT ck_usuarios_tipo_cuenta
        CHECK (tipo_cuenta IN ('demo','integrante','docente'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_usuarios_sesion_version'
      AND conrelid = 'sigpmat.usuarios'::regclass
  ) THEN
    ALTER TABLE sigpmat.usuarios
      ADD CONSTRAINT ck_usuarios_sesion_version
        CHECK (sesion_version >= 0);
  END IF;
END
$validacion$;

-- Sólo se eleva la cuenta administrativa original previamente acordada.
-- No se asignan permisos especiales a ningún otro usuario.
UPDATE sigpmat.usuarios u
SET es_superadministrador = TRUE
WHERE u.id_usuario = 1
  AND u.nombre_usuario = 'admin.demo'
  AND EXISTS (
    SELECT 1
    FROM sigpmat.usuario_roles ur
    JOIN sigpmat.roles r ON r.id_rol=ur.id_rol
    WHERE ur.id_usuario=u.id_usuario
      AND r.codigo='ADMIN_GENERAL' AND r.activo=TRUE
  );

-- Garantiza una única cuenta con control exclusivo de usuarios y futura auditoría.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sigpmat_superadmin_unico
  ON sigpmat.usuarios(es_superadministrador)
  WHERE es_superadministrador=TRUE;

COMMENT ON COLUMN sigpmat.usuarios.es_superadministrador IS
  'Privilegio exclusivo de administración de usuarios y futura auditoría; no asignable por API.';
COMMENT ON COLUMN sigpmat.usuarios.debe_cambiar_contrasena IS
  'Impide operaciones de negocio hasta sustituir la contraseña temporal.';
COMMENT ON COLUMN sigpmat.usuarios.sesion_version IS
  'Revoca JWT anteriores cuando se cambia o restablece contraseña.';
COMMENT ON COLUMN sigpmat.usuarios.tipo_cuenta IS
  'Clasificación académica para acceso de integrantes o docente, distinta del rol de negocio.';
COMMIT;

SELECT nombre_usuario, tipo_cuenta, es_superadministrador, debe_cambiar_contrasena, sesion_version
FROM sigpmat.usuarios ORDER BY id_usuario;
