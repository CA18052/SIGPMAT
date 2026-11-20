# Paquete 07 — Búsqueda de profesionales por turno y diagnóstico de eliminación

Fecha de auditoría: 20/11/2026. Solo se usan registros ficticios para ejemplos. No se borró ni alteró ningún empleado ni turno al investigar el fallo.

## Incidencia de eliminación

**Observación original:** la interfaz respondía «No fue posible completar la operación» al intentar eliminar un empleado creado manualmente.

**Diagnóstico SQL (solo lectura):** el empleado de código `001` (id 17) existe y no tiene cuenta, asignaciones, ausencias, cambios, propuestas, disponibilidades, excepciones, especialidades ni asistencias vinculadas. Cuenta con una adscripción departamental, que el backend elimina dentro de una transacción previa al empleado. El rol `sigpmat_app` carecía del permiso `DELETE` sobre todas las tablas CRUD relevantes, aunque sí tenía `SELECT/INSERT/UPDATE`.

**Corrección de permisos:** se ejecutó y validó en la rama de ensayo de Neon la instrucción GRANT limitada a seis tablas; luego se aplicó a la rama principal, sin modificar ni borrar registros. Script versionado: `database/sql/17_permisos_delete_crud.sql`. Se comprobaron los seis permisos mediante `has_table_privilege`, con seis resultados verdaderos.

**Corrección de API:** se devuelven `error`, `motivo`, `solucion` y `codigo` para rechazos conocidos del CRUD. El frontend los presenta en secciones legibles. Los detalles internos de excepciones desconocidas permanecen en los logs y el usuario recibe un código de incidencia.

**Estado de prueba:** permiso correcto confirmado con consultas SQL. No se ejecutó `DELETE` sobre el empleado id 17 ni contra datos de la demo. La eliminación real desde Render debe validarse después del despliegue y con un registro temporal autorizado por el equipo.

## Búsqueda de turnos

- Entrada de búsqueda dentro de **Turnos y cobertura**, adaptada a móvil y escritorio.
- Permite buscar por nombre/apellido del personal **asignado**, código del empleado, número exacto de turno, departamento, tipo, estado o fecha (YYYY-MM-DD).
- La consulta se ejecuta en PostgreSQL *antes de limitar el resultado a 100*, por lo que puede encontrar registros fuera de la página inicial. Retorna solamente turnos permitidos por el rol (administrador o jefe de área).
- La ficha muestra los nombres y códigos del personal efectivamente asignado, sin revelar DUI, correo o teléfono.
- Se excluyen asignaciones canceladas. Un empleado sin turno asignado no se presenta erróneamente como asignado.
- Debounce de 300 ms para evitar enviar una petición en cada pulsación.

## Pruebas SQL de lectura efectuadas

| Caso | Resultado observado |
|---|---|
| Buscar «Lucía» (profesional DEMO-MI-03) | 1 turno, id 4, con su nombre incluido |
| Buscar número `4` | 1 turno, id 4 (coincidencia exacta) |
| Buscar «Medicina Interna» | 3 turnos, ids 4, 5 y 6 |
| Buscar «Hugo Fernando» (sin asignaciones) | 0 turnos; resultado correcto |
| Buscar «Cardiología» con rol de jefe asignado a otra área | 0 turnos; respeta el filtro departamental |

**Pendiente:** prueba E2E desde navegador real después de la publicación para confirmar foco, navegación y presentación; no se documenta como ejecutada.

## Escenarios de aceptación

1. Administrador busca una persona con turno activo: aparecen sus turnos y la lista de personal.
2. Buscar por número exacto: solo se muestra ese turno si pertenece al ámbito autorizado.
3. Buscar un empleado sin asignación: mensaje de búsqueda sin resultados, sin indicar que no existe el empleado.
4. Jefe de área busca empleado de departamento ajeno: no se muestran turnos fuera de su ámbito.
5. Empleado temporal sin relaciones: confirmación de borrado, eliminación y actualización del listado.
6. Empleado con historial: respuesta 409 con razón y alternativa de inactivación.
7. Error por privilegios técnicos: mensaje de permisos, solución y registro del error en logs; no se revela información sensible de la base.
