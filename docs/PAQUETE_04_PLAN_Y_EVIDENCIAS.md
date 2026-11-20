# SIGPMAT — Paquete 04: auditoría, pruebas y estabilidad de la predefensa

**Fecha de corte:** 20 de noviembre de 2026  
**Proyecto:** Sistema Integral de Gestión de Personal Médico y Asignación de Turnos Hospitalarios (SIGPMAT)  
**Repositorio:** https://github.com/CA18052/SIGPMAT  
**Demo:** https://sigpmat-demo.onrender.com  
**Alcance:** calidad, seguridad, integridad, contingencias y evidencia verificable. **No incorporar módulos nuevos.**

> **Criterio de evidencia:** se distingue entre comprobación ejecutada, revisión estática del código y prueba funcional pendiente. El hecho de que TypeScript compile no demuestra por sí solo que los CRUD o la autenticación funcionen en producción.

## 1. Fuentes académicas y correspondencia

- **Universidad de El Salvador, guía «AVANCE DE PROYECTO 10%»** (3 de noviembre de 2026), apartado 4.10: plan de pruebas; tipos, funcionalidades, precondiciones, entradas, procedimientos, esperado, observado y estado. Mínimo cinco casos documentados. En el apartado 4.7 también solicita diez pantallas/prototipos representativos.
- **Material de lectura UES, unidad 4, semana 12 «Planificación de la conversión del software»**: respaldo, transformación, validación, seguimiento post-instalación y evaluación final.
- **Código de SIGPMAT**: API Fastify + TypeScript, frontend React/Vite, PostgreSQL en Neon y despliegue Render.

No se ha usado como comprobante una supuesta rúbrica final no verificada. La guía de avance no sustituye las instrucciones de una entrega posterior.

## 2. Inventario y evidencia técnica confirmada

| Comprobación | Resultado observado | Evidencia |
|---|---|---|
| Commit principal | `e263ba7bae8ed0480abe14c541a9883fca853e97` | GitHub rama `main` |
| Render: commit desplegado | **Exactamente el mismo commit** | Servicio `sigpmat-demo`; despliegue `dep-dc0cml67bikc73f4esg0` |
| Render: publicación | **Live**, 20/11/2026 22:36:42 UTC | Render Deploys / Events |
| GitHub CI frontend | **Aprobado** (React/Vite, TypeScript) | Commit `e263ba7` |
| GitHub CI backend | **Aprobado** (TypeScript) | Commit `e263ba7` |
| Smoke HTTP público | **12/12 aprobadas** el 20/11/2026 22:47 UTC | [GitHub Actions run 44831735338](https://github.com/CA18052/SIGPMAT/actions/runs/44831735338/job/136618084019) |
| Render: auto-deploy configurado | `yes` / `checksPass` / rama `main` | Render Service Settings |
| Render: disparadores últimos tres deploys | **Manual** | Historial real de Render |
| Empleados en Neon | 65 | Consulta `SELECT COUNT(*)` |
| Departamentos activos | 8 | Consulta SQL |
| Turnos abiertos | 24 | Consulta SQL |
| Asignaciones activas | 32 | Consulta SQL |
| Perfiles con foto o referencia | 64 | Consulta SQL |
| Cuentas | 2 | Consulta SQL |
| Respaldo PREDEFENSA | `respaldo-predefensa-2026-11-20` | Neon branch `br-aged-violet-bbnrndan`, **READY**, creado a partir de `main` después de la carga |

**Alcance del respaldo:** instantánea de los datos y esquema de PostgreSQL a la fecha de corte; no incluye el código GitHub, configuraciones secretas de Render ni fotografías almacenadas fuera de Neon (los retratos ilustrativos sí están versionados en el frontend). Mantener esta rama hasta después de la defensa; no restaurar ni borrar sin autorización.

### 2.1. Auditoría de integridad SQL

Consultas **SELECT** realizadas sobre Neon `neondb`, rama principal. Todas las cifras observadas son cero.

| Código | Anomalía buscada | Resultado | Estado |
|---|---|---:|---|
| BD-01 | DUI duplicados | 0 | Aprobada |
| BD-02 | DUI con formato ajeno a ocho dígitos, guion y uno | 0 | Aprobada |
| BD-03 | Turnos con fin igual o anterior al inicio | 0 | Aprobada |
| BD-04 | Asignaciones sin requerimiento asociado | 0 | Aprobada |
| BD-05 | Requerimientos cuyos cupos asignados exceden el máximo | 0 | Aprobada |
| BD-06 | Empleados cuyo cargo no existe | 0 | Aprobada |
| BD-07 | Cuentas activas sin rol activo | 0 | Aprobada |
| BD-08 | Referencias de retrato fuera del directorio `/retratos/` | 0 | Aprobada |
| BD-09 | Empleados activos sin adscripción departamental vigente | 0 | Aprobada |
| BD-10 | Asignaciones activas otorgadas a empleados no activos | 0 | Aprobada |

**Distribución observada de los 64 perfiles DEMO-:** 60 activos, dos inactivos, dos suspendidos. `admin.demo` tiene `ADMIN_GENERAL`; `jefe.demo` tiene `JEFE_AREA` y una jefatura departamental vigente. No se extrajeron DUI, teléfonos, contraseñas ni otros datos personales.

### 2.2. Prueba HTTP reproducible

- Script: `scripts/verificar_api_publica.mjs`.
- Workflow: `.github/workflows/smoke-publico.yml`.
- Ejecuta **solo GET**, sin credenciales ni operaciones destructivas.
- Comprueba disponibilidad de `/api/health`, interfaz `/`, imagen sintética y rechazo 401 de ocho rutas privadas, además de la separación entre API y SPA.
- **Resultado observado:** **12 de 12 pruebas aprobadas**, 20/11/2026 22:47 UTC, job `136618084019` del run `44831735338`. La API y la interfaz devolvieron 200, la imagen JPEG devolvió 200, las ocho rutas privadas rechazaron solicitudes anónimas con 401 y una ruta de API inexistente devolvió 404. [Evidencia reproducible en GitHub Actions](https://github.com/CA18052/SIGPMAT/actions/runs/44831735338/job/136618084019).
- El workflow puede lanzarse desde GitHub Actions `workflow_dispatch` para repetir el ensayo sin modificar la base.

## 3. Casos de prueba funcionales para la defensa (pendientes de evidencia)

La tabla siguiente cumple la estructura solicitada por la guía de la UES. **PENDIENTE no significa que la función falle:** significa que aún no se ha documentado aquí su resultado mediante una ejecución controlada y verificable.

### QA-01 — Inicio de sesión y revocación

- **Objetivo:** autenticar credenciales válidas y rechazar contraseñas erróneas.
- **Precondiciones:** Render Live; cuentas de demostración activas; contraseñas custodiadas por el equipo.
- **Datos de entrada:** `admin.demo` + contraseña conocida por el equipo; una contraseña incorrecta.
- **Procedimiento:** iniciar sesión; abrir Panel principal; cerrar sesión; intentar iniciar con contraseña incorrecta.
- **Resultado esperado:** acceso como administrador; al cerrar sesión desaparece el token; credencial incorrecta devuelve error sin revelar cuentas.
- **Resultado obtenido / estado:** Pendiente de captura y ejecución controlada.

### QA-02 — Permisos y acceso restringido por rol

- **Objetivo:** verificar RBAC desde interfaz y API.
- **Precondiciones:** `admin.demo` y `jefe.demo` disponibles.
- **Datos:** cuentas de ambos roles; empleados de áreas distintas.
- **Procedimiento:** entrar primero como ADMIN_GENERAL y luego JEFE_AREA; comparar visibilidad; comprobar que el rol de jefe no pueda crear/eliminar entidades administrativas ni ver información ajena.
- **Esperado:** administrador con permisos autorizados, jefe limitado a su área, solicitudes no autorizadas devuelven 403 desde API.
- **Obtenido / estado:** Pendiente. **Revisión estática:** `autorizar()` comprueba token, estado de cuenta y rol actualizado consultando PostgreSQL en cada petición.

### QA-03 — CRUD de departamentos

- **Objetivo:** alta, consulta, modificación y baja de un departamento temporal sin referencias.
- **Precondiciones:** rol ADMIN_GENERAL; respaldos ya existentes.
- **Datos:** código único `PRUEBA-NEU-04`, nombre `Neurología de ensayo`, ubicación `Torre de prueba`.
- **Procedimiento:** crear departamento, consultar, cambiar nombre/ubicación, eliminar **antes** de asignar empleados/turnos.
- **Esperado:** cada operación se refleja y la eliminación física solo funciona sin relaciones.
- **Obtenido / estado:** Pendiente; no ejecutar en Neon principal sin registrar el antes y después.

### QA-04 — Integridad de departamento con historial

- **Objetivo:** impedir borrar un departamento relacionado.
- **Precondiciones:** ADMIN_GENERAL; usar área DEMO- con empleados y turnos.
- **Datos:** departamento `DEMO-URG` u otro con vínculos.
- **Procedimiento:** intentar eliminar; observar respuesta.
- **Esperado:** rechazo HTTP 409; el departamento y su información histórica permanecen.
- **Obtenido / estado:** Pendiente de ejecución controlada; **no intentar borrar datos de la defensa** sin autorización explícita.

### QA-05 — CRUD de empleados

- **Objetivo:** crear empleado sin foto, actualizar datos y eliminarlo sin historial.
- **Precondiciones:** ADMIN_GENERAL; un departamento existente; código único `PRUEBA-EMP-04`.
- **Datos:** nombre ficticio, cargo, fecha, DUI sintético *opcional*.
- **Procedimiento:** crear, consultar, editar teléfono/fecha, comprobar persistencia tras recargar, eliminar antes de asignar turnos.
- **Esperado:** persiste la edición, aparece silueta sin foto, eliminación física permitida cuando no hay dependencias.
- **Obtenido / estado:** Pendiente de ejecución controlada.

### QA-06 — Fotografía opcional

- **Objetivo:** comprobar guardado duradero de una fotografía.
- **Precondiciones:** ADMIN_GENERAL; retrato propio o sintético autorizado, JPEG/PNG/WebP.
- **Datos:** foto ≤ 200 kB después de optimización.
- **Procedimiento:** registrar empleado temporal con foto; recargar, cerrar sesión y volver a entrar.
- **Esperado:** foto sigue presente, ya que se almacena en PostgreSQL y no en el disco temporal de Render.
- **Obtenido / estado:** Pendiente de prueba funcional.

### QA-07 — CRUD de turnos sin asignaciones

- **Objetivo:** programar, consultar, editar y eliminar un turno temporal.
- **Precondiciones:** ADMIN_GENERAL; departamento y cargo activos; horario futuro.
- **Datos:** horario futuro sin solapamientos, requerimiento de un cupo.
- **Procedimiento:** crear turno; modificar horario futuro; revisar; eliminar **sin asignar personal**.
- **Esperado:** las cuatro operaciones son posibles sin afectar el historial de otros turnos.
- **Obtenido / estado:** Pendiente de ejecución controlada.

### QA-08 — Restricción de eliminación por historial

- **Objetivo:** proteger integridad referencial de turnos asignados.
- **Precondiciones:** ADMIN_GENERAL; turno DEMO- con asignación.
- **Datos:** turno existente con asignaciones.
- **Procedimiento:** consultar sus dependencias; **no borrar la fila directamente**; demostrar rechazo seguro desde la acción de interfaz cuando esté expresamente autorizado para la demo.
- **Esperado:** no se elimina el turno; se informa que debe cancelarse o conservar historial.
- **Obtenido / estado:** Pendiente.

### QA-09 — Control de sobrecupo

- **Objetivo:** impedir que las asignaciones superen los cupos.
- **Precondiciones:** turno en ensayo con cupos cubiertos.
- **Datos:** candidato activo y elegible, pero requerimiento lleno.
- **Procedimiento:** intentar asignar.
- **Esperado:** PostgreSQL rechaza sobrecupo y no inserta nueva asignación.
- **Obtenido / estado:** Pendiente de ejecución de integración. El control SQL histórico de sobrecupos existentes sí pasó BD-05.

### QA-10 — Conflicto de horarios y especialidades

- **Objetivo:** impedir un solapamiento incompatible o una asignación que no cumple la acreditación.
- **Precondiciones:** entorno de ensayo; personal con horario ocupado o acreditación incompatible.
- **Datos:** candidato incompatible y horario definido.
- **Procedimiento:** intentar asignación en entorno controlado.
- **Esperado:** operación rechazada y datos originales conservados.
- **Obtenido / estado:** Pendiente.

### QA-11 — Interfaces móvil y escritorio

- **Objetivo:** verificar disposición responsiva, foco y navegación.
- **Precondiciones:** Safari en iPhone, navegador de escritorio y Render Live.
- **Procedimiento:** abrir/cerrar drawer, navegar, buscar empleados, filtrar turnos, abrir fichas y formularios, cerrar sesión.
- **Esperado:** sin desplazamiento horizontal accidental, botones táctiles legibles y datos completos.
- **Obtenido / estado:** El propietario ha confirmado previamente funcionamiento general en ambos dispositivos; faltan capturas finales y lista de comprobación firmada.

### QA-12 — Persistencia y contingencia

- **Objetivo:** confirmar que los registros sobreviven a la recarga y que el entorno puede recuperarse.
- **Precondiciones:** rama Neon `respaldo-predefensa-2026-11-20` disponible.
- **Procedimiento:** consultar registros, recargar navegador, verificar recuentos, revisar último deploy, confirmar plan local alternativo.
- **Esperado:** información estable y documentación para recuperación.
- **Obtenido / estado:** recuentos y respaldo verificados; restauración completa **no ejecutada** para evitar riesgos.

## 4. Despliegue automático de Render: hallazgo y plan seguro

**Hecho confirmado:** servicio `sigpmat-demo` apunta a la rama `main`, `autoDeploy=yes`, `autoDeployTrigger=checksPass`. Pese a ello, los despliegues de los paquetes recientes aparecen con disparador **manual**. El último `e263ba7` está Live.

**Lo que no se ha podido verificar:** webhooks o permisos de la instalación GitHub/Render; las consultas a los endpoints administrativos de GitHub no son accesibles a través de la integración disponible. Por tanto, no atribuir el problema a una causa concreta sin más evidencia.

**Antes de la defensa:** mantener la versión estable, comprobar en Render > Settings > Build & Deploy que la rama sea `main` y la integración de GitHub esté autorizada. Para futuras publicaciones, revisar la relación entre `checksPass` y los workflows de GitHub. Si no se dispara un deploy, utilizar **Manual Deploy → Deploy latest commit** y verificar el SHA y estado Live. No cambiar arbitrariamente a despliegue inmediato si esto pudiera publicar código que no haya pasado CI.

## 5. Plan de contingencia / recuperación

1. **Fallo de Render, Neon íntegro:** verificar estado del servicio, historial Deploys, Logs; permitir reinicio del servicio; usar el último despliegue Live conocido. Tener el entorno local probado con antelación.
2. **Fallo de publicación:** no insistir con commits nuevos; revisar SHA de `main`, ejecutar despliegue manual del último commit aprobado por GitHub Actions y confirmar respuesta `/api/health`.
3. **Datos dañados:** **no restaurar automáticamente**. Detener modificaciones, comparar con `respaldo-predefensa-2026-11-20`, evaluar divergencias y obtener autorización del equipo antes de restaurar.
4. **Fallo de navegador:** refrescar con actualización completa; comprobar el commit desplegado; abrir desde otro dispositivo; la caché del `index.html` usa `no-cache`.
5. **Presentación sin Internet:** usar versión local **ya probada** con su propia instancia PostgreSQL y API; no improvisar una migración el día de la defensa.
6. **Falta un rol, una prueba falla o hay latencia:** mostrar evidencia verificable previamente tomada, explicar la limitación con precisión y no inventar resultados.

## 6. Criterios de aceptación

- Infraestructura: GitHub `main` y Render Live corresponden al mismo commit — **verificado** al iniciar paquete.
- Respaldo de la versión de demostración — **creado y verificado READY**.
- Integridad básica de Neon: diez comprobaciones SQL sin anomalías — **verificado**.
- HTTP público y denegación de rutas sin autenticación — **12/12 comprobaciones aprobadas en GitHub Actions**.
- CRUD de tres módulos y rol jefe: pruebas funcionales con datos temporales y capturas — **pendiente de evidencia formal**.
- Recuperación local y restauración de backup — **planificada, no ejecutada**.
- Documentación y guion de defensa — ver documentos del Paquete 04 en `docs/`.

**Regla de cierre:** no identificar este paquete como completamente validado en producción hasta que se registren los resultados obtenidos de QA-01 a QA-12. El sistema puede estar operativo y contar con mejoras importantes sin que todas esas pruebas se hayan documentado aún.
