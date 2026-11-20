# SIGPMAT — Demostración hospitalaria de El Salvador (20/11/2026)

## Objetivo

Preparar SIGPMAT para una presentación académica con información **totalmente ficticia**, relaciones válidas entre entidades y una interfaz adaptable. Este conjunto **no representa registros de un hospital verdadero**.

## Estado de Neon verificado

- Proyecto: `sigpmat-demo`; base de datos: `neondb`.
- Se conservan las 24 tablas.
- Hay **64 empleados ficticios** con códigos `DEMO-*` y **un empleado creado manualmente** (65 en total).
- Ocho departamentos, diez especialidades y siete cargos.
- Veinticuatro turnos abiertos, además del historial anterior de tres turnos cancelados.
- Treinta y dos asignaciones activas: diurno 8/16 cupos, mixto 16/16 y nocturno 8/16.
- Se mantienen **admin.demo** y **jefe.demo** con sus roles originales.
- Se conservaron los ID de los 16 empleados ficticios previos y la vinculación de jefe.demo.

## Respaldo y ensayo

Antes de aplicar cambios a Neon main, se crearon las ramas:

- `respaldo-demo-2026-11-20`: copia del estado anterior **sin compute**, para recuperación.
- `ensayo-datos-2026-11-20`: entorno donde se aplicó la migración y la carga dos veces, verificando estabilidad y ausencia de duplicados el mismo día.

**No borrar estas ramas antes de terminar la defensa.** No modificar las cuentas o ejecutar `DROP SCHEMA`, `TRUNCATE` o eliminaciones indiscriminadas.

## Migraciones y scripts

1. `database/sql/13_perfiles_fotografias.sql` — incorpora registro profesional y fotografía opcional, valida formato básico del DUI y limita las fotos JPG/PNG/WebP a 200 kB. No elimina datos.
2. `database/sql/14_datos_demostracion_sv.sql` — carga 64 empleados, ocho departamentos, diez especialidades, turnos y coberturas. Actualiza datos de códigos DEMO-* y conserva el empleado manual y usuarios.
3. `database/sql/15_retratos_demo.sql` — relaciona cada perfil ficticio con uno de los 16 retratos SVG originales incluidos en `frontend/public/retratos/`, sin alterar imágenes subidas.

**Todos los scripts 13–15 ya se aplicaron a Neon main. No volver a ejecutarlos para la presentación.** La carga 14 es idempotente si se ejecuta dos veces el mismo día, pero los nuevos turnos se calculan relativamente a `CURRENT_DATE` y se generarían turnos adicionales en fechas diferentes.

## Campos salvadoreños y privacidad

El DUI es opcional y se presenta con formato `00000000-0`; la estructura verifica el formato, no certifica su vigencia ante RNPN. Los valores de ejemplo no se validaron como identidades auténticas: **son solo números sintéticos de ensayo**. Los teléfonos emplean ceros y los correos terminan en el dominio reservado `.invalid`.

El número de registro profesional es opcional para perfiles donde resulte pertinente y en la demo se marca con prefijo `SIM-`. **No equivale a una acreditación real**.

El listado público a los usuarios autorizados no entrega DUI ni contactos; esos campos se muestran en la vista de detalle exclusivamente a `ADMIN_GENERAL`. Ningún empleado ficticio representa un profesional verificable.

## Retratos y fotografías

Los 16 retratos SVG son **ilustraciones originales** de personal ficticio. No son fotografías de personas reales ni material sujeto a licencias de bancos de imágenes. Los empleados pueden aparecer con ilustración, fotografía subida o avatar de silueta neutra.

Al registrar un empleado, `ADMIN_GENERAL` puede subir JPG, PNG o WebP. El navegador reduce la imagen a un máximo de 320 px, intenta WebP y valida 200 kB finales. La API verifica tipo MIME, firma y tamaño. Las fotos subidas se almacenan en PostgreSQL en `foto_bytes`; no se guardan en el disco efímero de Render.

## Actualización de una instalación local existente

Antes de iniciar la nueva versión del backend en la base local `sigpmat_dev`, ejecutar **solamente** la migración 13 como propietario del esquema (con el servidor detenido):

```bash
cd "$HOME/Documents/SIGPMAT/GitHub_publicacion"
git pull --ff-only origin main
psql -U sigpmat_owner -d sigpmat_dev -f database/sql/13_perfiles_fotografias.sql
```

Los scripts 14 y 15 están preparados para `neondb`; **no deben ejecutarse contra el entorno local sin adaptar sus guardas y cuentas**. El proyecto local conserva sus registros.

## Verificación para la defensa

1. Abrir la dirección pública de Render, entrar como `admin.demo`.
2. Verificar 8 departamentos, 65 empleados visibles (con límite de 100).
3. Comprobar que se ven retratos y que el perfil manual sin foto muestra silueta.
4. Abrir un empleado ficticio y consultar su cargo, acreditación y datos simulados.
5. Filtrar empleados por departamento y buscar por nombre.
6. Comprobar la vista móvil de turnos y coberturas.
7. Registrar un empleado de ensayo con foto opcional; comprobar persistencia después de recargar.
8. Iniciar sesión como `jefe.demo` y comprobar alcance restringido a su departamento.
9. Conservar la versión local como respaldo y **no revelar contraseñas ni cadenas de conexión**.

**Este software sigue siendo una demostración académica, no un sistema habilitado para una operación hospitalaria real.**
