# Copia de seguridad de SIGPMAT

Antes de instalar nuevas versiones o trasladar la base a otro equipo, conviene guardar un respaldo de `sigpmat_dev`.

## Mac mini con PostgreSQL 18

Desde la copia del repositorio:

```bash
cd "$HOME/Documents/SIGPMAT/GitHub_publicacion"
git pull --ff-only origin main
bash scripts/respaldar_bd_mac.sh
```

El script pide la contraseña del usuario de PostgreSQL `sigpmat_owner`, guarda un archivo `.dump` en `~/Documents/SIGPMAT/Respaldos` y muestra su tamaño y suma SHA-256.

El respaldo incluye las tablas, relaciones y datos de la base local. Las cuentas de acceso de PostgreSQL (`sigpmat_owner`, `sigpmat_app`) son roles del servidor, por lo que **no se incluyen** en el archivo de la base de datos.

## Comprobar el archivo

El script utiliza `pg_restore --list` para revisar que PostgreSQL pueda leer el catálogo del respaldo. Esta comprobación no equivale a restaurarlo. Antes de depender de él para una migración real se debe hacer una restauración de prueba en una base aparte.

No guardar los respaldos en GitHub ni enviarlos a terceros: pueden contener contraseñas cifradas y otros registros de desarrollo. No borrar `sigpmat_dev` ni ejecutar el SQL inicial sobre la base actual.

## Al llevar SIGPMAT a la nube

Prepararemos una base vacía en Neon, aplicaremos las migraciones allí y cargaremos exclusivamente datos ficticios de demostración. No es necesario copiar las cuentas y los registros de ensayo del Mac a la nube.
