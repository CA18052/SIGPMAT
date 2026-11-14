# Hoja de ruta de la entrega final — SIGPMAT

**Fuente principal:** `Proyecto_Final.pdf`, Universidad de El Salvador, ciclo II-2026. Entrega: **viernes 20 de noviembre de 2026, 11:55 p. m.** La defensa puede celebrarse posteriormente; la fecha concreta debe confirmarse.

## Alcance mínimo demostrable

1. Iniciar sesión en interfaz web con dos roles diferentes.
2. Dashboard de indicadores calculados en PostgreSQL (no datos estáticos).
3. Consultar, crear, modificar y desactivar empleados, con control de permisos y relaciones.
4. Gestionar departamentos, cargos y especialidades; consulta con filtros.
5. Crear, consultar y gestionar turnos, requerimientos de cupos y asignaciones manuales.
6. Rechazar conflictos de turnos, sobrecupos, cargos no compatibles y accesos ajenos.
7. Mostrar una eliminación controlada de un turno de ensayo no referenciado, o justificar políticas de cancelación lógica.
8. Demostrar persistencia y modificaciones mediante la API y PostgreSQL.
9. Ejecutar pruebas HTTP y de interfaz; registrar resultados, defectos y correcciones.
10. Entregar informe final con plan de pruebas, métodos de conversión comparados, plan de conversión (responsables/fechas/riesgos), IA aplicada o propuesta documentada, conclusiones y referencias en APA 7.
11. Preparar explicación y participación técnica de cada integrante durante la defensa.

## Cronograma de trabajo propuesto (revisar diariamente)

| Fecha | Prioridad | Entregable verificable |
|---|---|---|
| Sáb. 14 nov. | P0 | Auditoría final, estructura GitHub, repo seguro, UI base, configuración |
| Dom. 15 nov. | P0 | Login y navegación + dashboard conectado a API |
| Lun. 16 nov. | P0 | CRUD de personal / departamentos / especialidades desde la interfaz |
| Mar. 17 nov. | P0 | Turnos, requerimientos, asignación manual, reglas y errores |
| Mié. 18 nov. | P0 | Pruebas E2E y conexión DB, correcciones, datos de demo, despliegue gratis |
| Jue. 19 nov. | P0 | Informe final APA 7, tabla de resultados, conversión e IA, guion de exposición |
| Vie. 20 nov. | P0 | Prueba general y respaldo local; entregar PDF + URL GitHub y demo antes de 23:55 |
| Sáb. 21 nov. | P0 | Ensayo/defensa si así se confirma oficialmente |

El orden es un compromiso de planificación, **no evidencia de que las actividades ya estén realizadas**.

## Criterios de terminado

Cada módulo debe tener interfaz navegable, operaciones respaldadas por SQL, autorización correcta, pruebas verdes, datos de demostración y al menos una evidencia reproducible. No declarar completada una función por la existencia de un prototipo.
