# SIGPMAT: criterios para el rediseño web

**Fecha de revisión:** 20 de noviembre de 2026  
**Estado:** referencias estudiadas; sin cambios de código ni despliegue.  
**Lote 1:** siete videos y tres capturas que compartió el equipo.

Este documento sirve para mantener las decisiones de diseño mientras seguimos reuniendo referencias. No es una lista de efectos que tengamos que copiar. Prioriza lo que realmente ayude a usar SIGPMAT.

## Hallazgos del primer lote

| Referencia | Idea identificada | Aplicación a SIGPMAT |
|---|---|---|
| Video 1: «Deja de centrar todos tus textos» | La alineación constante facilita escanear tarjetas con diferentes datos | Alinear a la izquierda nombres, cargos, instrucciones y estados. Reservar el centrado para excepciones puntuales |
| Video 2: «Deja de usar carruseles» | Un carrusel automático puede ocultar información y obligar a buscar lo que interesa | No usar carruseles para las tareas principales, alertas ni indicadores hospitalarios; mostrar las prioridades de forma visible |
| Video 3: «No uses botones primarios para todo» | Si todas las acciones compiten por atención, ninguna destaca | Una acción principal por contexto; secundarias con menor peso, y acciones peligrosas separadas y confirmadas |
| Video 4: «Cómo detectar un sitio hecho con IA» | El abuso de composiciones idénticas, tipografía y efectos genéricos transmite poca personalidad | Evitar la estética de dashboard clonado; construir jerarquía, ritmo y personalidad propios del contexto hospitalario |
| Video 5: «Deja de diseñar cards planas» | Agrupar información, destacar el dato decisivo y poner la acción cerca mejora la lectura | Rediseñar fichas de empleados y turnos con información priorizada; no añadir sombras, gráficos o bordes por decoración |
| Video 6: «Deja de meter botones en tu barra» | Navegación y acciones tienen funciones diferentes | En móvil, barra inferior para secciones; crear empleado/turno como acción contextual fuera de esa barra |
| Video 7: «No diseñes páginas estáticas» | Easing, pequeñas demoras y movimiento con propósito comunican estado | Transiciones breves para apertura de paneles, confirmaciones y cambios de vista; reducir o eliminar animaciones según la preferencia del sistema |
| Imagen IMG_5697: seguridad | Lista de revisión: secretos, autorización, consultas parametrizadas, validación, TLS, límites y dependencias | Auditoría técnica independiente del rediseño; comprobar lo ya implementado antes de atribuir cumplimiento |
| Imagen IMG_5698: privacidad y cumplimiento | Evitar patrones oscuros, recopilar solo lo necesario y facilitar la accesibilidad | Aviso claro de demostración, uso de datos sintéticos, formularios honestos. No copiar políticas de pagos ni banners de cookies si no aplican |
| Imagen IMG_5699: `emilkowalski/skills` | Conjunto de prácticas de diseño y animación; la captura destaca `animate-expo` | Para la web React son más pertinentes `mobile-native`, `animate` y `review-animations`. `animate-expo` es para React Native/Expo |

## Prioridad 0: rehacer la experiencia en teléfono

Observación del usuario: en el teléfono el encabezado y las secciones ocupan filas sucesivas que desplazan el contenido útil hacia abajo y producen una sensación de desorden. **No resolverlo simplemente apilando todo el escritorio.** La aplicación debe sentirse diseñada para móvil desde el principio.

### Problemas comprobados en el CSS actual

En `frontend/src/styles.css`:

- Bajo `@media(max-width:760px)`, `.sidebar` pasa a `flex-direction:row` y `flex-wrap:wrap`: la navegación puede ocupar varias líneas antes del contenido.
- `.panel-heading.wrap-heading{display:block}` separa encabezado y filtros, mientras `.filters{margin-top:18px}` añade otra fila.
- `.filters input,.filters select{width:100%}` fuerza controles de anchura completa incluso cuando podrían agruparse o mostrarse bajo demanda.
- `.table-wrap{overflow-x:auto}` es útil como fallback, pero las tablas de empleados y turnos necesitan una presentación específica en móvil.
- Algunos textos funcionales son de 10–11 px y los controles / tarjetas dependen de reglas de escritorio. Debemos medir legibilidad y tamaño de pulsación.

Estas observaciones salen del código; todavía no hemos hecho una auditoría visual completa en un teléfono real.

### Diseño móvil que vamos a construir

1. **Estructura propia:** encabezado compacto con identidad y perfil; navegación inferior con icono y texto para las secciones principales, respetando el área segura del iPhone. No convertir los enlaces de navegación en botones de acción.
2. **Contenido visible pronto:** quitar filas de título redundantes; abrir cada sección con el dato/tarea relevante y una cabecera corta.
3. **Acciones contextuales:** «Crear turno» en Turnos; «Registrar empleado» en Personal. Una sola acción dominante por pantalla.
4. **Búsqueda y filtros:** búsqueda accesible en la vista correspondiente; filtros agrupados en una interfaz compacta y clara, no tres campos de ancho completo uno debajo de otro.
5. **Empleados:** sustituir la tabla de seis columnas por filas o fichas escaneables en móviles: nombre, código, cargo, estado y acceso a detalles; conservar tabla en escritorio.
6. **Turnos:** vista móvil por turnos, con hora, departamento, cupos, estado y acción; no obligar a recorrer horizontalmente toda la tabla.
7. **Métricas:** tarjetas compactas o resumen de 2 columnas cuando el ancho lo permita. Priorizar alertas de cobertura real sobre decoración.
8. **Formularios y paneles:** etiquetas siempre visibles, entradas grandes, errores cercanos al campo y diálogos/paneles adaptados al espacio.
9. **No desbordamientos:** usar Flexbox para grupos y controles; Grid cuando convenga para la estructura; `min-width:0`, `flex-wrap`, `minmax()` y medidas fluidas según el contenido. Flexbox y Grid son complementarios.
10. **Pruebas:** revisar 320, 360, 375, 390, 430, 768, 1024 y 1440 píxeles, orientación horizontal, zoom, teclado, texto ampliado y zonas seguras. Evitar desplazamiento horizontal de página; los componentes de datos complejos pueden utilizar desplazamiento interno accesible cuando sea apropiado.

## Criterios generales para la nueva identidad

- Conservar el dominio sanitario y la seriedad de un sistema que administra personal, sin copiar interfaces comerciales.
- Escala tipográfica coherente, buen contraste y una densidad informativa razonable.
- Colores semánticos para disponible, incompleto, cancelado, error y confirmación; nunca comunicar estados solo mediante color.
- Iconografía uniforme con etiquetas cuando el significado no sea evidente.
- Estados bien trabajados: cargando, vacío, error, éxito, deshabilitado y sin permisos.
- Animaciones de opacidad o desplazamiento pequeñas y funcionales, con respeto a `prefers-reduced-motion`. Evitar parallax por decoración en módulos clínicos.
- No hacer cambios de API, permisos o base de datos solamente para mejorar la apariencia.
- Mantener el despliegue de producción operativo durante el rediseño: cambios en una rama separada y pruebas antes de integrar a `main`.

## Fuentes externas para cuando implementemos

- MDN, diseño adaptable: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design
- W3C, WCAG 2.2, adaptación a 320 px: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- Chrome for Developers, layouts modernos: https://developer.chrome.com/docs/modern-web-guidance/guides/css/css-layout
- Emil Kowalski, animación web: https://www.skills.sh/emilkowalski/skills/animate
- Emil Kowalski, refinamiento móvil para web: https://www.skills.sh/emilkowalski/skills/mobile-native
- Emil Kowalski, revisión de animaciones: https://www.skills.sh/emilkowalski/skills/review-animations

## Decisiones aún abiertas

Todavía faltan las próximas referencias del usuario, la revisión final de identidad visual y una prueba real de la interfaz móvil. **No modificar la web solo con este lote.** Una vez acordado el diseño, empezar por la navegación, los listados y las operaciones más usadas en móvil y comprobar que el escritorio no retroceda.
