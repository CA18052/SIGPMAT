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

- **Código implementado:** interfaz lateral y botón flotante para conversar con AURA; OpenAI Responses API + Function Calling desde Fastify, nunca desde React.
- **Consultas:** catálogos, reportes de cobertura, turnos, personal disponible por horario y recomendaciones de turnos. El modelo no tiene acceso SQL libre ni puede leer contraseñas, DUI o teléfonos.
- **Operaciones supervisadas:** preparación de turno, empleado o asignación como una propuesta firmada y temporal; aprobación humana, contraseña, ticket de un solo uso y ejecución a través de rutas existentes.
- **Diferencia conceptual:** IA generativa interpreta solicitudes y explica hallazgos; reglas PostgreSQL determinan elegibilidad; Fastify aplica roles, valida y ejecuta cambios.
- **Limitación:** un plan de crear turno + asignar personas se ejecuta por pasos, no se da una autorización global a la IA.
- **Demostración sugerida una vez configurada y probada:** preguntar disponibilidad de un médico para mañana; analizar cupos pendientes; preparar un turno, confirmar contraseña y verificar el evento de auditoría.
- **Proveedor gratuito preferente:** GroqCloud Free + modelo `openai/gpt-oss-20b` (modelo abierto hospedado por Groq). Clave `GROQ_API_KEY` privada en Render; sin pago de OpenAI. Sin clave, no se simula IA. Las cuotas gratuitas están sujetas a los límites del proveedor. No hay fallback automático a API de pago.
- **Estado de prueba:** código incluido; verificar CI y funcionamiento real del proveedor una vez configurado. Documento: `docs/PAQUETE_09_AURA_ASISTENTE_INTELIGENTE.md`.

## Plan de funciones próximas: NO IMPLEMENTADAS

- **Render:** despliegues automáticos desde GitHub comprobados; conservar configuración `After CI Checks Pass` mientras el propietario así lo desee.
- **Paquete 10:** pulido visual, accesibilidad, pruebas de regresión y cierre de la defensa.

**Regla de exactitud del guion final:** separar el recorrido de funciones comprobadas de las propuestas, registrar la versión Live de Render y no inventar cuentas, pantallas, respuestas de IA, métricas ni resultados de pruebas.
