# SIGPMAT — Guion de demostración y defensa técnica

**Versión de referencia:** GitHub `main`, commit `e263ba7bae8e` (antes de iniciar auditoría); Render `sigpmat-demo.onrender.com`. Verificar versión publicada después de cualquier cambio posterior.

**Duración sugerida:** 10–12 minutos para el recorrido. Ajustar al tiempo concedido por el docente. **Entorno ficticio**, no utilizado en un hospital real.

## Preparación previa del equipo

- Comprobar acceso a https://sigpmat-demo.onrender.com desde computadora y teléfono.
- Verificar en Render > Deploys que el último commit aprobado esté `Live`; si no, publicar manualmente el último commit **después** de CI.
- Confirmar credenciales de `admin.demo` y `jefe.demo` entre los integrantes sin publicarlas en diapositivas ni capturas.
- Preparar una ficha de empleado y un turno con historial, **sin alterar** los 64 empleados DEMO-.
- Tener códigos de ensayo únicos (`PRUEBA-DEP-04`, `PRUEBA-EMP-04`) que no choquen con datos existentes.
- Usar navegador con zoom estándar; cerrar páginas y notificaciones ajenas a la demostración.
- Mantener abierta localmente una versión comprobada como contingencia, no como improvisación.

## Secuencia sugerida (cronómetro de práctica)

### 0:00–1:00 — Contexto y objetivo

«SIGPMAT es un prototipo académico para administrar personal médico, departamentos y asignación de turnos hospitalarios. Resuelve la dificultad de consolidar información de recursos humanos y coordinar cobertura por turnos. Los datos presentados son ficticios y se ajustan al contexto de El Salvador».

Explicar que en esta demo no hay registros reales de pacientes ni credenciales de médicos reales.

### 1:00–2:10 — Arquitectura

Mostrar el esquema lógico:

`Navegador (React + Vite)` → `API (Fastify + TypeScript / JWT)` → `PostgreSQL (Neon)`

Explicar que Render ejecuta la aplicación web y entrega el frontend compilado y API; Neon administra almacenamiento relacional. GitHub contiene el código y los controles de compilación.

- **Decisión técnica:** arquitectura por capas y API; separación de responsabilidades.
- **Seguridad:** JWT con vencimiento, cuentas y roles verificados contra PostgreSQL en cada solicitud protegida.
- **Despliegue:** control por commits de GitHub, Render y CI.

### 2:10–3:00 — Panel principal y catálogo hospitalario

Iniciar con `admin.demo`. Mostrar indicadores calculados desde la base, departamentos activos, filtros y personal. Señalar que los empleados ficticios cuentan con fotografía sintética o avatar y cargos vinculados.

**Preguntas técnicas a anticipar:** ¿de dónde salen las cifras? ¿cómo garantizan que un contador no sea un número fijo?

### 3:00–5:00 — CRUD de departamentos y empleados

1. Registrar **un departamento temporal sin vínculos**, por ejemplo `PRUEBA-DEP-04`.
2. Editar su ubicación y nombre; confirmar cambio en directorio.
3. Eliminarlo **antes** de registrar personal.
4. Registrar un empleado temporal en uno de los departamentos activos con foto opcional (o sin foto para mostrar la silueta).
5. Cambiar teléfono o fecha de ingreso; refrescar y comprobar persistencia.
6. Eliminarlo **antes de asignarlo** a cualquier turno.

**Aclaración al jurado:** «SIGPMAT no permite borrar una entidad cuando tiene un historial dependiente; la desactivación preserva integridad y trazabilidad».

### 5:00–7:10 — Turnos y cobertura

1. Abrir la lista de turnos y las tarjetas adaptables.
2. Mostrar cobertura de un turno con requerimientos y asignación.
3. Crear un turno temporal **futuro** con un cupo, sin asignaciones.
4. Cambiar su horario (también futuro), consultar y eliminarlo sin historial.
5. Consultar otro turno que sí posea asignación para explicar por qué el sistema impide su eliminación física.

No intentar alterar los turnos con asignaciones creados para ilustrar la cobertura sin respaldo y acuerdo del equipo.

### 7:10–8:20 — Reglas de negocio y permisos

Cerrar sesión del administrador; entrar como `jefe.demo`. Mostrar diferencia de permisos, alcance departamental y ausencia de acciones administrativas.

**Si hay tiempo y el ambiente es seguro**, mostrar que el servidor responde con 403 ante una operación no autorizada. No hace falta enviar comandos destructivos en la defensa para justificar RBAC.

### 8:20–9:30 — Diseño y datos

Demostrar el menú móvil y fichas de empleados; explicar validaciones, fotografías opcionales y nombres ilustrativos. Resaltar el uso de transacciones SQL y claves foráneas.

### 9:30–10:40 — Validaciones, calidad y conclusiones

Mostrar GitHub Actions con backend/frontend aprobados, auditoría de 10 reglas de integridad sin anomalías y respaldo de Neon creado. Explicar qué casos se han ejecutado y cuáles permanecen pendientes de evidencia; **no declarar pruebas pendientes como aprobadas**.

Concluir: SIGPMAT demuestra administración estructurada, autenticación por rol, persistencia y protección de dependencias; todavía es un prototipo académico y requeriría pruebas adicionales, auditoría y controles normativos antes de uso real.

## Reparto sugerido de intervenciones

Asignar responsables reales antes del ensayo; no atribuir trabajo a un integrante sin conocerlo.

| Rol | Intervención |
|---|---|
| Expositor de análisis | Problema, objetivos, actores, requisitos y alcance |
| Expositor de diseño | Arquitectura por capas, modelos, DFD, normalización, relaciones |
| Expositor de implementación | React, Fastify, Neon, seguridad, CRUD, turnos |
| Expositor de validación | Pruebas, evidencias, integridad, despliegue, limitaciones |

Si son menos personas, combinar bloques; si son más, repartir según el proyecto.

## Preguntas frecuentes de la defensa

**¿Por qué PostgreSQL?** Porque el dominio tiene entidades relacionadas que necesitan claves primarias y foráneas, restricciones y transacciones; además facilita verificar integridad y consistencia de las asignaciones.

**¿Qué sucede si dos usuarios asignan el último cupo?** Las validaciones no deben depender solamente de React: PostgreSQL debe imponerlas en la operación y evitar el sobrecupo incluso con peticiones simultáneas. **Comprobar concurrencia en una prueba específica antes de afirmar que quedó demostrada.**

**¿Por qué no se pueden borrar siempre empleados o turnos?** Porque los registros de asignación, usuarios y políticas se relacionan con ellos. Un borrado físico indiscriminado comprometería la trazabilidad; el sistema utiliza eliminación controlada y estados lógicos.

**¿Las fotografías y DUI son reales?** No. Los perfiles, documentos y retratos son ficticios o generados sintéticamente para la demostración. No se trata de un registro de personal real.

**¿Qué ocurre si Render se cae?** El software tiene código reproducible en GitHub, datos respaldados en Neon y un entorno local que debe estar probado previamente. El respaldo de Neon no implica que la restauración se haya ensayado.

**¿Cómo se asegura la autorización?** La API verifica la firma del JWT y consulta el estado de cuenta y roles vigentes en PostgreSQL para cada solicitud protegida. Los controles visuales no sustituyen esa verificación del servidor.

**¿Qué pruebas han realizado?** Distinguir: verificaciones CI del código, auditoría SQL efectivamente ejecutada, smoke HTTP público según ejecución disponible en GitHub Actions, y pruebas manuales documentadas con estado real. Nunca afirmar que una prueba pendiente pasó.

**¿Qué falta para un hospital real?** Análisis normativo de datos personales, revisión integral de seguridad, pruebas de carga y concurrencia, auditoría de operaciones, soporte, recuperación y aceptación de usuarios, entre otras validaciones; el sistema actual es académico.

## Regla de oro durante la presentación

No improvisar una migración, no restaurar datos en vivo, no hacer despliegues mientras se expone y no modificar las 64 fichas ni los 24 turnos de muestra. Utilizar registros efímeros independientes y explicar las restricciones de forma técnica y verificable.
