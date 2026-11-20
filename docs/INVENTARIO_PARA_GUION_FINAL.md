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

## Plan de funciones próximas: NO IMPLEMENTADAS

- **Paquete 05:** cuentas individuales de los cinco integrantes, cuenta del docente, administración de usuarios, invitaciones y roles.
- **Paquete 06:** reautenticación para operaciones sensibles, bitácora de auditoría exclusiva del superadministrador, controles adicionales de sesión.
- **Paquete 07 — Render:** solucionar completamente la publicación automática, si la integración GitHub/Render lo permite; comprobarlo con un despliegue efectivamente marcado como automático.
- **Paquete 08:** reportes avanzados y propuestas automáticas de cobertura.
- **Paquete 09:** AURA, asistente de inteligencia artificial con información y permisos controlados por Fastify.

**Regla de exactitud del guion final:** separar el recorrido de funciones comprobadas de las propuestas, registrar la versión Live de Render y no inventar cuentas, pantallas, respuestas de IA, métricas ni resultados de pruebas.
