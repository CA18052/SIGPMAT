# SIGPMAT — Paquete 08: Reportes y propuestas de cobertura

**Fecha de desarrollo:** 20 de noviembre de 2026.  
**Rama:** `mejora/paquete-08-reportes-y-cobertura`  
**Fuente de datos:** PostgreSQL/Neon del proyecto; sin datos reales de pacientes.  
**Importante:** este paquete **NO usa un modelo de inteligencia artificial**. AURA, asistente de IA generativa, corresponde al Paquete 09.

## 1. Reportes de cobertura

- Nuevo apartado **«Reportes y análisis»** visible para los roles autorizados: administradores, jefes de área y visitantes públicos de solo lectura.
- Consulta `GET /api/reportes/cobertura?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`.
- Filtra turnos por **fecha local de inicio en El Salvador**. Rango de hasta 367 días.
- Estadísticas por departamento: número de turnos abiertos/cancelados, cupos solicitados, personal asignado, cupos sin cubrir y porcentaje de cobertura.
- Los **turnos cancelados** no cuentan como cupos requeridos ni asignaciones en cobertura.
- Las consultas se agregan en PostgreSQL, sin cifras fijas. El rol `JEFE_AREA` recibe solamente el departamento de jefatura vigente; `VISITANTE_LECTURA` solo cifras agregadas, nunca DUI, teléfonos o correos.
- Gráficos de progreso y anillo de cobertura, con versión móvil y estados vacíos.
- Exportación **CSV** UTF-8 con BOM, campos protegidos frente a fórmulas de hoja de cálculo. Opción **Imprimir / Guardar PDF** a través de la función de impresión del navegador, con CSS para formato A4.
- Los datos del CSV corresponden únicamente al ámbito autorizado y a las fechas consultadas.

## 2. Asistencia para asignar personal

- En **Turnos → Detalles**, si el turno está abierto y todavía no ha comenzado, aparece **«Candidatos recomendados → Proponer personal»** para cuentas administrativas.
- Ruta de solo lectura `GET /api/turnos/:id/sugerencias`. El rol visitante recibe 403 incluso si intenta consultar directamente.
- Para cada requerimiento pendiente se muestran hasta 5 candidatos elegibles.
- Reglas observadas:
  - Empleado activo.
  - Cargo idéntico al requerido.
  - Adscripción vigente al departamento **durante todo el turno**.
  - Especialidad acreditada y vigente, cuando se requiera.
  - Sin solapamiento con asignaciones activas de otros turnos.
  - Sin solicitud de ausencia aprobada que coincida.
  - Sin excepción de no disponibilidad que coincida.
- Orden: menor número de turnos en una ventana aproximada de 30 días antes y 30 días después, seguido de apellido, nombre e identificador. **Es una heurística de reparto de carga, no una medida certificada de equidad laboral.**
- Un botón **«Asignar»** requiere aceptación explícita y contraseña actual, igual que los otros cambios del Paquete 06.
- Se utiliza el endpoint y trigger PostgreSQL existentes; las reglas se vuelven a validar **en el instante de guardar** para evitar confiar en una lista calculada previamente. Un candidato puede dejar de ser elegible entre la propuesta y la confirmación.
- No se realizan cambios de personal automáticamente ni se guardan propuestas sin autorización humana.
- Si el turno está cancelado, ya comenzó, o tiene todos los cupos cubiertos, se evita recomendar asignaciones innecesarias.

## 3. Comprobaciones SQL realmente ejecutadas

**Consulta de cobertura:** período 2026-11-01 al 2026-12-31, Neon `main`:

| Departamento | Turnos | Abiertos | Cupos | Asignados | Pendientes |
|---|---:|---:|---:|---:|---:|
| Cardiología | 3 | 3 | 6 | 4 | 2 |
| Cirugía General | 5 | 3 | 6 | 4 | 2 |
| Diagnóstico por Imágenes | 3 | 3 | 6 | 4 | 2 |
| Ginecología y Obstetricia | 3 | 3 | 6 | 4 | 2 |
| Medicina Interna | 3 | 3 | 6 | 4 | 2 |
| Pediatría | 3 | 3 | 6 | 4 | 2 |
| Unidad de Cuidados Intensivos | 3 | 3 | 6 | 4 | 2 |
| Urgencias | 4 | 3 | 6 | 4 | 2 |
| **Total** | **27** | **24** | **48** | **32** | **16** |

**RBAC SQL:** al consultar con los parámetros de `jefe.demo`, la consulta devolvió exclusivamente **Medicina Interna**, tres turnos y dos cupos pendientes.

**Recomendaciones SQL:** la consulta sobre el requerimiento **#9** de Urgencias devolvió **dos candidatos elegibles**, `DEMO-URG-01` y `DEMO-URG-07`, ambos sin turnos recientes en la ventana analizada. Las comprobaciones se realizaron **en modo lectura** y no se asignó personal.

Estas cifras describen el estado de la base en el momento de la consulta; cambiarán al registrar nuevas asignaciones o turnos.

## 4. Pruebas funcionales de aceptación

| Código | Acción | Resultado esperado | Estado |
|---|---|---|---|
| R08-01 | Abrir reportes como administrador | Estadísticas del período, sin números fijos | Pendiente de E2E |
| R08-02 | Cambiar intervalo de fechas | Recalcula todas las cifras y gráficos | Pendiente de E2E |
| R08-03 | Exportar CSV | Se descarga archivo con cifras y UTF-8 | Pendiente de E2E |
| R08-04 | Imprimir / Guardar PDF | Diálogo de impresión muestra hoja A4 sin navegación | Pendiente de E2E |
| R08-05 | Abrir reportes como jefe | Solo datos de su departamento | SQL verificado; E2E pendiente |
| R08-06 | Abrir reportes como visitante | Solo agregados, sin datos personales | Pendiente de E2E |
| R08-07 | Proponer candidatos de turno #9 | Dos candidatos elegibles con explicación | SQL verificado; E2E pendiente |
| R08-08 | Proponer turno ya iniciado/cancelado | Sin recomendaciones de escritura | Pendiente de E2E |
| R08-09 | Visitante solicita endpoint de sugerencias | HTTP 403 | Pendiente de E2E |
| R08-10 | Confirmar candidato sugerido | Requiere contraseña y pasa validaciones DB | Pendiente de E2E |
| R08-11 | Asignación concurrente/ocupación de último cupo | El trigger impide sobrecupo y horarios incompatibles | Pendiente de prueba funcional |

La compilación de TypeScript/Vite y la ejecución de SQL comprueban aspectos distintos; **no declarar las once pruebas E2E como aprobadas si no se han realizado**.

## 5. Demostración sugerida

1. En **Reportes**, mostrar 48 cupos, 32 asignados y 16 pendientes en el intervalo indicado, sujeto a datos reales de Neon.
2. Mostrar departamentos con brechas, cambiar fechas y descargar CSV o abrir impresión PDF.
3. Cambiar a **Turnos**, buscar turno #9 de Urgencias y pulsar **Proponer personal**.
4. Explicar por qué se sugieren perfiles con cargo y departamento compatibles, sin solapamientos y con menor carga reciente.
5. Si se dispone de un turno de ensayo futuro, asignar una recomendación utilizando contraseña de confirmación y volver al reporte para mostrar la cobertura actualizada.
6. Aclarar que el recomendador sigue reglas y que **AURA de IA generativa se desarrollará después**, sin atribuirle capacidades inexistentes.

## 6. Publicación

La integración con Render está funcionando en modo `checksPass` y se verificaron varios despliegues automáticos con `trigger=new_commit`. Conservar la configuración existente salvo nueva decisión del propietario. No se necesita migración SQL para este paquete.

**Inventario de defensa:** consultar también `docs/INVENTARIO_PARA_GUION_FINAL.md`.
