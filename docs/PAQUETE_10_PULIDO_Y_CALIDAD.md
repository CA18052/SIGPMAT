# Paquete 10 — Pulido de AURA y cierre de calidad

**Proyecto:** SIGPMAT · Análisis y Diseño de Software II, UES.  
**Fecha:** 20 de noviembre de 2026 (El Salvador).  
**Alcance:** presentación, precisión de IA, accesibilidad y regresión. No se cambia el esquema de PostgreSQL ni se generan empleados, turnos o asignaciones.

## Mejoras implementadas

### 1. Respuestas profesionales sin HTML no confiable

AURA muestra correctamente el subconjunto de Markdown que aparece en sus respuestas: **negritas, énfasis, código en línea, listas, encabezados, citas, bloques de código y tablas**. Las tablas tienen desplazamiento horizontal en teléfonos y encabezados semánticos, sin comprimir las columnas hasta hacerlas ilegibles. Los textos enviados por el modelo se renderizan como contenido React escapado; no se interpreta HTML, no se ejecutan scripts y los enlaces/imágenes de Markdown no crean peticiones externas. No se añaden dependencias ni se utiliza `dangerouslySetInnerHTML`.

Se añadieron pruebas automáticas para reconocer tablas con varias columnas, listas, citas, bloques de código, saltos CRLF y textos con HTML sin interpretarlo.

### 2. Interfaz y accesibilidad

- La cabecera introductoria de AURA se reduce al comenzar la conversación para dejar más espacio a los mensajes en iPhone.
- Las sugerencias iniciales aparecen solo antes de escribir la primera pregunta, no en medio de una sesión activa.
- Cada mensaje conserva su **hora real de envío o recepción**; antes todos los mensajes mostraban la hora de la última representación del componente.
- Las propuestas muestran cuenta regresiva aproximada, estado «sin guardar», «ejecutada» o «caducada» y se deshabilitan al vencer.
- «Revisar y ejecutar» abre una revisión propia, con botones **Cancelar** y **Aprobar y verificar contraseña**, navegación con teclado (Tab, Shift+Tab, Escape). **No evita la reautenticación**: el componente `requestApi` sigue solicitando la contraseña actual para cada escritura.
- La interfaz incluye etiquetas para lectores de pantalla, mensajes de estado, contraste y dimensiones táctiles adecuadas.
- Se respeta `prefers-reduced-motion` en las animaciones existentes.

### 3. Precisión de la inteligencia artificial

- AURA recibe instrucciones más específicas: **«elegible según restricciones registradas» NO equivale a disponibilidad confirmada por el profesional**.
- Los recuentos `turnos_recientes` miden carga en una ventana de fechas, no el número de conflictos.
- La respuesta de búsqueda de personal explicita restricciones evaluadas y señala que no dispone de una confirmación personal de disponibilidad.
- Al preparar un turno, Fastify consulta el nombre real de la especialidad, comprueba que esté activa y devuelve la **prioridad efectiva**. La vista previa utiliza cantidades naturales («1 plaza», «2 plazas»), nombres y fechas legibles en zona horaria de El Salvador.
- El modelo recibe un objeto `detalle_validado` para explicar la propuesta. No puede alterar el comprobante firmado ni el contenido del cambio aprobado por el usuario.

**Limitación:** la precisión absoluta del texto producido por el modelo no se puede garantizar; las reglas de negocio y permisos siguen aplicándose en Fastify y PostgreSQL al guardar.

## Compatibilidad

Se conserva GroqCloud Free `openai/gpt-oss-20b`; sin fallback de pago. Se conservan JWT, roles, reautenticación, bitácora y comprobantes firmados. El turno #28 y la asignación #37 son evidencias históricas de la prueba anterior; **no se modifican como parte de este paquete**.

## Evidencia y validación

| Verificación | Método | Evidencia |
|---|---|---|
| Markdown en tablas/listas/citas | Pruebas de frontend `test:aura-markdown` | CI de PR, confirmar resultado |
| Compilación React/TypeScript | `npm run build` | CI de PR, confirmar resultado |
| Compatibilidad Fastify/AURA | `npm run typecheck`, build, tests | CI de PR, confirmar resultado |
| Nueva consulta de especialidades | SQL `SELECT` sobre Neon | Cirugía General/ID4 y Médico especialista/ID3 devueltos correctamente |
| Revisión visual en móvil | Prueba manual en Safari | Pendiente después de publicar |
| Flujo completo de propuesta con nuevo estilo | Prueba manual del usuario | Pendiente; no crear cambios nuevos sin necesidad |
| Exportación PDF/CSV, roles, alta de empleados | Regresión completa | Pendiente de verificación E2E exhaustiva |

Las pruebas de React con lógica pura no sustituyen ensayos de usabilidad y navegador.

## Pruebas manuales recomendadas

1. Abrir AURA desde un iPhone, preguntar **«¿Cuáles son los departamentos?»** y comprobar que las tablas son legibles y se desplazan horizontalmente sin romper el diseño.
2. Preguntar **«¿Qué criterios usa SIGPMAT para proponer médicos disponibles?»** y comprobar que AURA distingue elegibilidad de disponibilidad confirmada.
3. Abrir/cerrar AURA con teclado en escritorio y probar Escape.
4. Crear una **nueva propuesta sin guardarla**, revisar que muestre prioridad, jornada, especialidad, fechas legibles y diálogo de aprobación. Pulsar Cancelar y confirmar que no existen cambios.
5. Comprobar que una propuesta caduca y no ofrece un botón que pueda ejecutarse.
6. Verificar que una cuenta visitante de solo lectura no pueda ejecutar ni guardar operaciones.

## Para el guion final

La demostración real ya validada en el Paquete 09 permanece documentada: turno #28, requerimiento #28, asignación #37, cobertura del 100 % y bitácora. Las mejoras del Paquete 10 explican el acabado visual y por qué se adoptaron renderizado seguro y ejecución supervisada. No atribuir a esta entrega pruebas que no fueron ejecutadas.
