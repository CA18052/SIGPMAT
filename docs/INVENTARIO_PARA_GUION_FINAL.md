# SIGPMAT — Inventario acumulativo para el guion final de la demostración

**Propósito:** conservar las funciones implementadas y sus puntos de demostración para redactar **el guion completo únicamente cuando el equipo lo solicite**. Este archivo no es el guion definitivo; no declara funcionalidades futuras como terminadas.

## Funciones operativas verificadas en código

### Paquete 01 — Navegación móvil
- Menú lateral adaptable para teléfonos y escritorio; backdrop, controles táctiles y acceso al perfil.
- Cierre explícito de sesión y navegación accesible.
- **Demostración sugerida:** abrir menú en teléfono, navegar, salir con el botón visible.

### Paquete 02 — Datos hospitalarios salvadoreños y visualización
- Directorio con nombres, códigos de empleados, cargos, estados y búsqueda por filtros.
- Departamentos con ubicación y total de personal adscrito activo.
- Fotografía opcional del empleado; retratos sintéticos realistas para perfiles ficticios y silueta predeterminada cuando no hay foto.
- Campos de identificación y contacto adaptados al contexto de El Salvador (DUI, teléfono, registro profesional).
- Fichas de turno responsivas con cobertura y personal asignado.
- **Demostración sugerida:** mostrar retratos, entrar al perfil, buscar por nombre/código, filtrar área, mostrar silueta y formulario.

### Paquete 03 — CRUD administrativo
- Crear, consultar, modificar y eliminar un empleado temporal sin historial, con controles de integridad.
- CRUD de departamentos y opción de desactivar cuando corresponda.
- CRUD de turnos; crear turno futuro, modificarlo si no hay asignaciones históricas y eliminarlo cuando no tenga dependencias.
- Cancelar asignaciones o turnos conservando registros históricos, conforme a permisos.
- **Demostración sugerida:** crear/editar/eliminar tres registros temporales y explicar la diferencia entre borrado físico y baja lógica.

### Paquete 04 — Auditoría de calidad
- Compilación de frontend React/Vite y backend Fastify/TypeScript en GitHub Actions.
- Auditoría de diez restricciones de integridad SQL sin anomalías en la fecha de su ejecución.
- Prueba HTTP pública de solo lectura con doce de doce comprobaciones aprobadas en GitHub Actions.
- Rama de respaldo `respaldo-predefensa-2026-11-20` en Neon.
- **Demostración sugerida:** mostrar las pruebas y describir la copia de seguridad y recuperación; no afirmar que se restauró un respaldo si no se ha ensayado.

### Mejoras posteriores a los paquetes iniciales
- **Sesión al recargar:** recargar el navegador mantiene el módulo activo y restaura la sesión de esa pestaña, sujeta al vencimiento original del JWT (15 minutos); los botones redundantes de actualizar se retiraron. CI incluye siete pruebas de sesión.
- **Buscador de turnos:** buscar por número exacto de turno, departamento, tipo, fecha, nombre o código de personal **asignado**; mostrar los integrantes asignados tanto en escritorio como en móvil.
- **Errores CRUD explicativos:** indicar causa del rechazo y solución recomendada. Los registros con historial no se eliminan indiscriminadamente.
- **Corrección de permisos CRUD:** conceder DELETE al rol de aplicación solo sobre las seis tablas requeridas por las operaciones autorizadas de la API.
- **Paquete 07 — Pulido final:** retirar avisos de funcionalidades todavía no implementadas del panel y mensajes técnicos de los listados; utilizar ayudas contextuales y pie institucional `SIGMA · Universidad de El Salvador`.
- **Demostración sugerida:** buscar «Lucía» en turnos, comprobar quién está asignado, buscar ID exacto, mostrar rechazo de eliminación de un registro con historial, recargar con el navegador y comprobar que conserva el acceso si el JWT no venció.

## Paquete 05 — Cuentas individuales y evaluación

- **Implementado en código (pendiente de despliegue y validación de accesos):** administrador exclusivo de cuentas, alta por carnet, cuentas de docente, passwords Argon2id generadas o manuales, primer cambio obligatorio, cierre de sesiones anteriores al cambiar/restablecer claves y bloqueo/habilitación.
- **Superadministración:** la cuenta original puede actualizar su usuario a su propio carnet, previa verificación de contraseña, sin transferir privilegios.
- **Demostración sugerida una vez desplegado y comprobado:** mostrar el módulo de usuarios como superadmin, crear cuenta temporal, iniciar sesión y cambiar contraseña, verificar que una cuenta operativa no accede a Usuarios.
- **Pendiente de ejecución humana:** introducir los carnets reales, generar cuentas reales y del docente, entregar credenciales privadas, ejecutar pruebas de login y permisos desde el navegador. No afirmar que estas pruebas pasaron antes de obtener evidencia.
- **No implementado todavía:** registro abierto por invitación de un solo uso; se mantiene cerrado para evitar altas administrativas públicas.

## Paquete 06 — Registro público y control de operaciones

- **Registro público:** alta desde bienvenida con carnet de dos letras mayúsculas y cinco dígitos, contraseña elegida (mínimo 12 caracteres). El backend asigna únicamente `VISITANTE_LECTURA`; no otorga permisos administrativos.
- **Recorrido de solo lectura:** visitante consulta personal, departamentos y turnos, sin acceso a DUI ni datos de contacto, ni controles para modificar.
- **Confirmación de identidad:** crear, editar, eliminar o cancelar muestra un diálogo para volver a pedir contraseña; Fastify exige comprobante de un solo uso, vinculado a la acción.
- **Auditoría:** tabla persistente y pantalla exclusiva del superadministrador con autor, fecha, recurso, acción, resultado y campos afectados, sin valores sensibles.
- **Filtros avanzados del personal:** departamento, cargo y estado combinables; búsqueda puntual por nombres/código.
- **Demostración sugerida:** registrar un carnet ficticio autorizado para la demo, entrar como visitante y mostrar consultas sin edición; luego entrar como administrador, editar un registro temporal con confirmación, y mostrar el evento en la bitácora desde superadmin.
- **Pruebas E2E de reautenticación, registro y permisos:** requieren sesión real después de publicación. No afirmar que se completaron antes de documentarlas.

## Paquete 08 — Reportes y planificación asistida

- **Reportes operativos:** módulo «Reportes y análisis», intervalo de fechas, indicadores reales por departamento, gráficos de cobertura, cupos pendientes y porcentajes calculados en PostgreSQL.
- **Exportación:** CSV UTF-8 seguro y opción «Imprimir / Guardar PDF» desde el navegador, con diseño A4.
- **Reglas de acceso:** visitantes leen solo información agregada; jefes únicamente la cobertura de su departamento.
- **Propuestas de personal:** «Proponer personal» en el detalle de turnos futuros; hasta cinco candidatos por requerimiento, con cargo y especialidad compatibles, adscripción vigente, sin conflictos de horario/ausencias y orden de menor carga reciente.
- **Confirmación:** el usuario autoriza manualmente cada asignación y verifica su contraseña; el trigger de PostgreSQL revalida todas las reglas al guardar.
- **Precisión conceptual:** el recomendador es determinista; **no se presenta como aprendizaje automático** ni como AURA. La IA generativa real es el Paquete 09.
- **Demostración sugerida:** abrir reportes, revisar cupos pendientes, cambiar fechas, exportar; luego abrir un turno futuro con vacantes, solicitar candidatos y explicar su elegibilidad. Asignar en un registro temporal si está autorizado.
- **Estado de verificación:** consultas SQL reales verificadas en Neon, incluidas restricciones del jefe y candidatos de Urgencias; pruebas completas de navegador y exportación siguen pendientes.

## Paquete 09 — AURA, asistente inteligente (integración de API)

- **Código implementado:** interfaz lateral y botón flotante para conversar con AURA; Responses API compatible de Groq + Function Calling desde Fastify, nunca desde React.
- **Consultas:** catálogos, reportes de cobertura, turnos, personal disponible por horario y recomendaciones de turnos. El modelo no tiene acceso SQL libre ni puede leer contraseñas, DUI o teléfonos.
- **Operaciones supervisadas:** preparación de turno, empleado o asignación como una propuesta firmada y temporal; aprobación humana, contraseña, ticket de un solo uso y ejecución a través de rutas existentes.
- **Diferencia conceptual:** IA generativa interpreta solicitudes y explica hallazgos; reglas PostgreSQL determinan elegibilidad; Fastify aplica roles, valida y ejecuta cambios.
- **Limitación:** un plan de crear turno + asignar personas se ejecuta por pasos, no se da una autorización global a la IA.
- **Demostración sugerida una vez configurada y probada:** preguntar disponibilidad de un médico para mañana; analizar cupos pendientes; preparar un turno, confirmar contraseña y verificar el evento de auditoría.
- **Proveedor gratuito preferente:** GroqCloud Free + modelo `openai/gpt-oss-20b` (modelo abierto hospedado por Groq). Clave `GROQ_API_KEY` privada en Render; sin pago de OpenAI. Sin clave, no se simula IA. Las cuotas gratuitas están sujetas a los límites del proveedor. No hay fallback automático a API de pago.
- **Estado de prueba:** conexión real de Groq, consultas, propuesta, creación de turno y asignación supervisada **comprobadas**; otras funciones y la regresión final pendientes. Documento: `docs/PAQUETE_09_AURA_ASISTENTE_INTELIGENTE.md`.

## Evidencia de AURA verificada — 20 de noviembre de 2026 (El Salvador)

- **Proveedor IA real conectado:** GroqCloud Free, modelo de pesos abiertos `openai/gpt-oss-20b`, mediante Responses API compatible y Function Calling. El usuario comprobó desde Safari consultas reales de departamentos, comprensión de fechas, consulta de elegibilidad y preparación de operaciones.
- **Turno creado desde AURA:** `id_turno=28`, Cirugía General, martes 24/11/2026, 09:00–17:00 (hora de El Salvador), diurno, un cupo de médico especialista, requerimiento `id_requerimiento=28`, prioridad normal. Creación autorizada por usuario `admin.demo`, confirmada en PostgreSQL y en auditoría.
- **Asignación real desde AURA:** `id_asignacion=37`, empleado `id_empleado=13`, `DEMO-CIR-01` (Paula Mariana Fuentes Hernández), requerimiento 28, estado `asignada`. Validación de Neon: **1 cupo requerido, 1 asignación activa = cobertura del 100 %**.
- **Auditoría verificada:** `POST /api/aura/ejecutar` con HTTP 200 y `POST /api/turnos/28/asignaciones` con HTTP 201, ambos exitosos y asociados a `admin.demo`. Esta evidencia es de un entorno académico con datos ficticios.
- **Incidencia y resolución:** dos solicitudes de asignación fallaron inicialmente con mensaje genérico `PROVEEDOR`; PR #15 incorporó diagnóstico de Groq y reintento delimitado. La siguiente solicitud preparó la propuesta y se ejecutó exitosamente.
- **Limitaciones observadas:** el chat muestra Markdown sin formatear (tablas, negritas); la IA llegó a afirmar «ventana de disponibilidad» aunque la consulta garantiza únicamente ausencia de restricciones registradas. Corregir presentación y precisión del lenguaje en Paquete 10.
- **Propuesta de demostración:** consultar disponibilidad de un profesional, preparar turno futuro, explicar el borrador, aprobar con contraseña, consultar candidatos, aprobar una asignación y verificar cobertura + auditoría. Para repetir en vivo, utilizar un **nuevo turno de ensayo**: el #28 ya está cubierto y no debe reutilizarse para otra asignación.
- **Alcance verificado:** pruebas reales de consulta, propuesta, creación y asignación; no declarar automáticamente probadas las restantes rutas de AURA (p. ej., alta de empleados), la seguridad completa ante ataques o la exportación PDF.

## Paquete 10 — Acabado profesional, accesibilidad y precisión de AURA

- **Lectura de respuestas enriquecidas:** tablas Markdown con desplazamiento horizontal, listas, citas, encabezados, negritas y código en AURA; no se interpreta HTML ni se ejecutan enlaces/imágenes remotas del modelo.
- **Diseño móvil:** cabecera compacta mientras se conversa, sugerencias únicamente al iniciar, horas individuales de los mensajes y respuesta desplazable.
- **Propuestas temporales:** estado de ejecución/caducidad, contador de vencimiento y botón deshabilitado al expirar, sujeto siempre a verificación final del servidor.
- **Revisión antes de ejecutar:** diálogo accesible dentro de AURA con cancelación, navegación por teclado y aprobación explícita, seguida por la contraseña del Paquete 06.
- **Precisión:** diferenciar «elegible sin restricciones registradas» de «disponibilidad confirmada», no confundir turnos recientes con conflictos, y mostrar prioridad efectiva, especialidad real y fechas legibles en propuestas.
- **Pruebas de CI:** nuevas pruebas de reconocimiento Markdown, más compilación frontend y regresión backend. La validación visual en Safari y pruebas E2E quedan señaladas por separado hasta ejecutarlas.
- **Guion sugerido:** mostrar una consulta con tabla visual, pedir disponibilidad con criterios, preparar propuesta y cancelar sin guardar; explicar la confirmación y la auditoría usando la evidencia real del turno #28 y asignación #37.
- **Documento:** `docs/PAQUETE_10_PULIDO_Y_CALIDAD.md`.

## Plan de funciones próximas: NO IMPLEMENTADAS

- **Render:** despliegues automáticos desde GitHub comprobados; conservar configuración `After CI Checks Pass` mientras el propietario así lo desee.
- **Regresión final:** pendiente validar visualmente Safari móvil, exportación PDF/CSV y las rutas administrativas no ensayadas.

**Regla de exactitud del guion final:** separar el recorrido de funciones comprobadas de las propuestas, registrar la versión Live de Render y no inventar cuentas, pantallas, respuestas de IA, métricas ni resultados de pruebas.
