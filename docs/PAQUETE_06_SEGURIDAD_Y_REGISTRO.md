# SIGPMAT — Paquete 06: registro público, reautenticación, auditoría y filtros

## Objetivo

Implementar las cuatro mejoras aprobadas antes de la defensa:
1. Alta desde la pantalla de bienvenida con **carnet UES exactamente dos letras mayúsculas y cinco dígitos**.
2. Acceso de estas nuevas cuentas exclusivamente de **lectura** (sin crear, modificar ni eliminar).
3. Reautenticación con la contraseña para cada operación protegida de escritura y bitácora global visible **solo al superadministrador**.
4. Filtros combinables en Personal hospitalario: departamento, cargo y estado; búsqueda por nombre/código independiente.

## Decisiones de seguridad

### Registro público

- Endpoint `POST /api/auth/registrar` no requiere sesión pero **ignora cualquier rol aportado**: asigna únicamente `VISITANTE_LECTURA` en una transacción PostgreSQL.
- El carnet debe cumplir `^[A-Z]{2}[0-9]{5}$`, es único sin diferenciar mayúsculas.
- La contraseña la elige el usuario, con mínimo 12 caracteres; hash Argon2id, nunca texto plano.
- Nombre para mostrar es opcional. Si no lo indica, se utiliza el carnet.
- Se limita el ritmo de registro (3 peticiones por 10 minutos).
- El carnet **no se valida contra registros universitarios ni demuestra quién es su titular**. Esta limitación debe explicarse si el docente pregunta por verificación de identidad.
- Los visitantes acceden al directorio, departamentos, cargos, especialidades y turnos, pero no reciben DUI, teléfono, correo ni registro profesional. Las vistas ocultan controles de escritura, pero además el backend bloquea dichas peticiones.
- **Las cuentas creadas desde Usuarios por el superadministrador permanecen administrativas** y no se modifican.

### Confirmación de contraseña por operación

1. El usuario inicia una acción de crear, editar, eliminar o cancelar.
2. React muestra un cuadro para ingresar la contraseña **actual**.
3. `POST /api/auth/confirmar-operacion` verifica Argon2id del usuario vigente y emite un comprobante aleatorio de 32 bytes, válido durante 60 segundos, asociado a usuario, método HTTP y ruta.
4. El frontend transmite el comprobante solamente en `X-SIGPMAT-Confirmacion` durante esa operación.
5. Un hook de Fastify valida y **consume atómicamente** el comprobante en Neon; si falta, expiró o se reutilizó, rechaza la operación con HTTP 428. No se guardan contraseñas en localStorage ni en bitácora.
6. Las excepciones necesarias son inicio de sesión, alta pública, comprobación de contraseña y cambio de contraseña propio; el cambio de clave exige la contraseña actual.
7. **Cada nueva escritura necesita una confirmación nueva.** Las solicitudes de solo lectura no exigen contraseña adicional.

La prueba formal del comportamiento de concurrencia y las pruebas manuales completas quedan pendientes de ejecutar en Render después del despliegue. El error de contraseña equivocada no debe cerrar la sesión válida.

### Auditoría

- Tabla `sigpmat.auditoria_seguridad`, con actor, fecha, método, ruta, resultado, HTTP, identificador de solicitud y nombres de campos afectados **sin almacenar valores sensibles**.
- Registra escrituras de usuarios autenticados y altas públicas exitosas. Puede registrar también rechazos que lleguen a la autorización.
- El rol de aplicación tiene `SELECT/INSERT` sobre esta tabla, pero **no UPDATE ni DELETE**. El endpoint `GET /api/admin/auditoria` requiere `ADMIN_GENERAL` **y** `es_superadministrador=TRUE`, incluso si se llama directamente desde otra herramienta HTTP.
- El registro se escribe tras la respuesta del servidor: es una auditoría de aplicación **de mejor esfuerzo**, no un diario transaccional inalterable. Un fallo de PostgreSQL al escribir la bitácora se informa en logs del servidor; la operación de negocio podría haberse completado. No afirmar auditoría forense infalible en la defensa.
- El propio módulo permite consultar los últimos 100 eventos; no hay eliminación desde la interfaz.

## Filtros de personal hospitalario

- Departamento: solamente los departamentos disponibles para el perfil.
- Cargo: catálogo de cargos presentes entre los empleados visibles.
- Estado: activo, inactivo o suspendido.
- Los tres filtros pueden combinarse y se procesan en PostgreSQL **antes de LIMIT 100**.
- La caja de búsqueda puntual por código, nombres, apellidos o cargo se aplica al resultado de los filtros.
- Las consultas de un jefe de área siguen sujetas al alcance de su departamento; no se amplían sus permisos.

## Verificaciones técnicas ejecutadas en rama Neon de ensayo

Consultas realizadas sobre `ensayo-paquete06` sin modificar las cuentas de producción:

- **26 tablas** en el esquema (24 originales + dos tablas nuevas).
- El rol `VISITANTE_LECTURA` existe una sola vez.
- La cuenta original sigue siendo el único superadministrador; no se crearon cuentas públicas.
- `sigpmat_app` posee `INSERT` sobre auditoría y `UPDATE` sobre confirmaciones.
- La restricción de `tipo_cuenta` admite `visitante`.
- Simulación SQL de un comprobante sintético: la primera actualización de consumo devolvió **1 registro**; la segunda utilización devolvió **0**; intentar consumirlo con una ruta distinta devolvió **0**. Esto comprueba la condición SQL de uso único, **no sustituye una prueba de integración HTTP**.
- Frontend y backend: se exige aprobación de GitHub Actions para integrar.

## Migración y despliegue

**IMPORTANTE: Render es 100 % manual por decisión del propietario. No iniciar deploy mediante herramientas.**

1. Rama de respaldo en Neon `respaldo-previo-paquete06-2026-11-20`. 
2. Migración `database/sql/19_registro_reautenticacion_auditoria.sql` ensayada con éxito en `ensayo-paquete06`; creó dos tablas y el rol de lectura, amplió check de `tipo_cuenta` y otorgó permisos restringidos.
3. Comprobar 26 tablas y CI de frontend/backend; fusionar PR solo tras CI aprobado.
4. Aplicar la migración a Neon **main** antes de desplegar Fastify. Durante este intervalo, la versión vieja de `/api/health/db` espera 24 tablas y puede notificar `degraded` hasta que se publique el nuevo backend que espera 26.
5. Abrir Render y ejecutar manualmente **Deploy latest commit**, después de comprobar que coincide con el SHA final aprobado de GitHub.
6. Comprobar con tres cuentas distintas: superadministrador, administrador operativo y visitante de lectura. No usar credenciales reales en las capturas académicas.

## Casos de prueba sugeridos para la defensa

| Código | Caso | Resultado esperado |
|---|---|---|
| P06-01 | Carnet `AB12345` + contraseña elegida válida | Cuenta con VISITANTE_LECTURA, sin permiso ADMIN_GENERAL |
| P06-02 | Carnet mal formado `ABC1234` | Rechazo HTTP 400 por formato |
| P06-03 | Doble registro de un carnet ya existente | Rechazo HTTP 409 |
| P06-04 | Visitante consulta personal, turnos y departamentos | HTTP 200; sin DUI/teléfono/contacto |
| P06-05 | Visitante intenta POST/PATCH/DELETE directo | HTTP 403; no hay cambios |
| P06-06 | Administrador intenta guardar sin comprobante | HTTP 428 |
| P06-07 | Contraseña incorrecta en confirmación | Rechazo de confirmación, sesión válida conservada |
| P06-08 | Contraseña correcta + comprobante único | Operación autorizada una vez |
| P06-09 | Reutilizar comprobante o cambiar ruta | HTTP 428 |
| P06-10 | Superadministrador abre Bitácora | Registro visible con actor, operación, fecha y resultado |
| P06-11 | Administrador operativo/visitante solicita `/api/admin/auditoria` | HTTP 403 |
| P06-12 | Filtrar por departamento + cargo + estado y buscar nombre | Resultados correctos sin saltarse los roles |

**Distinguir resultados:** la compilación de TypeScript y las verificaciones SQL de ensayo se documentan como realizadas. Los doce casos E2E no se marcan aprobados hasta contar con evidencia de ejecución real.

## Alcance del guion final

Demostrar alta pública por carnet, navegación de lectura sin botones CRUD; luego cerrar sesión, entrar con administrador, mostrar filtros y realizar una operación temporal confirmando contraseña; por último, entrar como superadmin y consultar el evento en la bitácora. No mostrar ni leer contraseñas durante la defensa.

Este documento integra el inventario `docs/INVENTARIO_PARA_GUION_FINAL.md`; el guion definitivo se redactará cuando el equipo lo solicite.
