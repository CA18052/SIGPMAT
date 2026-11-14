#!/usr/bin/env bash
set -euo pipefail
umask 077

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL="/opt/homebrew/opt/postgresql@18/bin/psql"

if [[ ! -x "$PSQL" ]]; then
  echo 'No se encontró psql de PostgreSQL 18 en Homebrew.' >&2
  exit 1
fi
if [[ ! -d "$RAIZ/backend/node_modules" ]]; then
  echo 'Primero ejecuta npm ci en la carpeta backend del repositorio.' >&2
  exit 1
fi

echo 'Configuración de Neon para la demostración de SIGPMAT'
echo 'Crea un proyecto Neon nuevo con base neondb.'
echo 'Crea el rol de PostgreSQL sigpmat_app en la consola de Neon.'
echo 'Copia las conexiones DIRECTAS (sin pooler). No compartas esas direcciones.'
echo
read -r -s -p 'Conexión del propietario de Neon (oculta): ' NEON_OWNER_URL
printf '\n'
read -r -s -p 'Conexión de sigpmat_app (oculta): ' NEON_APP_URL
printf '\n'

validar() {
  node -e '
    const uri = new URL(process.argv[1]);
    if (!["postgres:", "postgresql:"].includes(uri.protocol) ||
        !uri.hostname.endsWith(".neon.tech") ||
        uri.pathname !== "/neondb") process.exit(1);
    if (process.argv[2] === "app" &&
        decodeURIComponent(uri.username) !== "sigpmat_app") process.exit(2);
  ' "$1" "$2"
}
if ! validar "$NEON_OWNER_URL" owner || ! validar "$NEON_APP_URL" app; then
  echo 'Las conexiones deben ser de Neon, base neondb; la segunda de sigpmat_app.' >&2
  exit 1
fi

export PGSSLROOTCERT=system
export PGSSLMODE=verify-full

run_sql() {
  local titulo="$1" conexion="$2" archivo="$3"
  echo
  echo "===== $titulo ====="
  "$PSQL" --no-psqlrc --set=ON_ERROR_STOP=1 --dbname="$conexion" \
    --file="$RAIZ/$archivo" --pset=pager=off
}

echo 'IMPORTANTE: los comandos que siguen modifican exclusivamente tu base Neon nueva.'
echo 'No se usarán credenciales ni datos del PostgreSQL local.'
run_sql 'Esquema y tablas' "$NEON_OWNER_URL" 'database/neon/01_estructura.sql'
run_sql 'Permisos de la aplicación' "$NEON_OWNER_URL" 'database/neon/02_permisos.sql'
run_sql 'Roles de SIGPMAT' "$NEON_OWNER_URL" 'database/sql/03_roles_iniciales.sql'
run_sql 'Reglas operativas' "$NEON_OWNER_URL" 'database/sql/06_reglas_negocio_sigpmat.sql'
run_sql 'Servicios y personal ficticio' "$NEON_APP_URL" 'database/neon/03_datos_demostracion.sql'

echo
echo '===== Comprobando estructura ====='
"$PSQL" --no-psqlrc --set=ON_ERROR_STOP=1 --dbname="$NEON_APP_URL" \
  --command="SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema='sigpmat' AND table_type='BASE TABLE'"

echo
echo '===== Preparando acceso de demostración ====='
echo 'Introduce dos contraseñas diferentes. No se mostrarán en pantalla.'
(
  cd "$RAIZ/backend"
  DATABASE_URL="$NEON_APP_URL" CREAR_CUENTAS_DEMO=SI \
    npm run bootstrap:neon
)

unset NEON_OWNER_URL NEON_APP_URL
echo
echo 'Instalación Neon finalizada. Las contraseñas no se enviaron a GitHub.'
echo 'Siguiente paso: configurar el servicio gratuito en Render.'
