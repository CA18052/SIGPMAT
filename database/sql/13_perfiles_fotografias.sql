-- SIGPMAT | Migración 13: perfil laboral y fotografía opcional
-- No reinicia tablas, no altera contraseñas ni modifica registros existentes.
-- Ejecutar sobre una copia/entorno validado; luego en neondb de Neon.
BEGIN;
ALTER TABLE sigpmat.empleados
  ADD COLUMN IF NOT EXISTS numero_registro_profesional VARCHAR(40),
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_mime VARCHAR(20),
  ADD COLUMN IF NOT EXISTS foto_bytes BYTEA;
DO $checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_sigpmat_dui_formato' AND conrelid='sigpmat.empleados'::regclass) THEN
    ALTER TABLE sigpmat.empleados
      ADD CONSTRAINT ck_sigpmat_dui_formato CHECK (dui IS NULL OR dui ~ '^[0-9]{8}-[0-9]$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_sigpmat_foto_segura' AND conrelid='sigpmat.empleados'::regclass) THEN
    ALTER TABLE sigpmat.empleados ADD CONSTRAINT ck_sigpmat_foto_segura
      CHECK (
        (foto_bytes IS NULL AND foto_mime IS NULL)
        OR (foto_bytes IS NOT NULL AND foto_mime IN ('image/jpeg','image/png','image/webp') AND octet_length(foto_bytes) BETWEEN 1 AND 200000)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_sigpmat_foto_url' AND conrelid='sigpmat.empleados'::regclass) THEN
    ALTER TABLE sigpmat.empleados
      ADD CONSTRAINT ck_sigpmat_foto_url CHECK (foto_url IS NULL OR foto_url LIKE '/retratos/%');
  END IF;
END
$checks$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_empleado_registro_profesional
  ON sigpmat.empleados (numero_registro_profesional)
  WHERE numero_registro_profesional IS NOT NULL;
COMMENT ON COLUMN sigpmat.empleados.numero_registro_profesional IS 'Número de inscripción profesional, opcional; usar valores ficticios para la demo';
COMMENT ON COLUMN sigpmat.empleados.foto_url IS 'Ruta pública local de retrato autorizado de demostración; no acepta URLs externas arbitrarias';
COMMENT ON COLUMN sigpmat.empleados.foto_mime IS 'Tipo MIME de foto subida de hasta 200 kB';
COMMENT ON COLUMN sigpmat.empleados.foto_bytes IS 'Imagen opcional procesada y acotada; Render no ofrece almacenamiento local persistente en plan gratuito';
COMMIT;
