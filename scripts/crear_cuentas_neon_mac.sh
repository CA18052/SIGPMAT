#!/usr/bin/env bash
set -euo pipefail
umask 077

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo 'Cuentas de demostración de SIGPMAT en Neon'
echo 'Este paso no modifica sigpmat_dev ni ejecuta de nuevo las migraciones.'
echo
read -r -s -p 'Pega la conexión DIRECTA de Neon para sigpmat_app (oculta): ' NEON_APP_URL
printf '\n'

if ! NEON_APP_URL="$NEON_APP_URL" node -e '
 const value=process.env.NEON_APP_URL;
 try {
   const u=new URL(value);
   if (!["postgresql:","postgres:"].includes(u.protocol) ||
       u.username !== "sigpmat_app" ||
       !u.hostname.endsWith(".neon.tech") ||
       u.hostname.includes("-pooler.") ||
       u.pathname !== "/neondb") process.exit(1);
 } catch {process.exit(1);}
'; then
  echo 'La conexión debe ser la DIRECTA de sigpmat_app, base neondb, en Neon.' >&2
  exit 1
fi

(
  cd "$RAIZ/backend"
  DATABASE_URL="$NEON_APP_URL" CREAR_CUENTAS_DEMO=SI npm run bootstrap:neon
)
unset NEON_APP_URL
echo
echo 'Cuentas creadas. Guarda las contraseñas de admin.demo y jefe.demo de forma privada.'
