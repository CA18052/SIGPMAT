#!/usr/bin/env bash
set -euo pipefail
umask 077

PG_BIN="/opt/homebrew/opt/postgresql@18/bin"
PG_DUMP="$PG_BIN/pg_dump"
PG_RESTORE="$PG_BIN/pg_restore"
DESTINO="$HOME/Documents/SIGPMAT/Respaldos"
FECHA="$(date '+%Y-%m-%d_%H-%M-%S')"
ARCHIVO="$DESTINO/sigpmat_dev_$FECHA.dump"

if [[ ! -x "$PG_DUMP" || ! -x "$PG_RESTORE" ]]; then
  echo 'No se encontro PostgreSQL 18 en Homebrew. Revisa la instalacion antes de continuar.' >&2
  exit 1
fi

mkdir -p "$DESTINO"

echo 'Respaldo de SIGPMAT (base local sigpmat_dev)'
echo "Destino: $ARCHIVO"
echo 'Se solicitara la contrasena de sigpmat_owner.'

limpiar() { rm -f -- "$ARCHIVO"; }
trap limpiar ERR INT TERM

"$PG_DUMP" \
  --host=127.0.0.1 \
  --port=5432 \
  --username=sigpmat_owner \
  --password \
  --format=custom \
  --compress=6 \
  --file="$ARCHIVO" \
  sigpmat_dev

"$PG_RESTORE" --list "$ARCHIVO" > "$ARCHIVO.catalogo.txt"
[[ -s "$ARCHIVO" && -s "$ARCHIVO.catalogo.txt" ]]
chmod 600 "$ARCHIVO" "$ARCHIVO.catalogo.txt"
trap - ERR INT TERM

echo ''
echo 'Respaldo creado correctamente.'
ls -lh "$ARCHIVO"
shasum -a 256 "$ARCHIVO"
echo ''
echo 'El catalogo del respaldo se puede consultar en:'
echo "$ARCHIVO.catalogo.txt"
echo 'Nota: consultar el catalogo no sustituye una prueba de restauracion.'
