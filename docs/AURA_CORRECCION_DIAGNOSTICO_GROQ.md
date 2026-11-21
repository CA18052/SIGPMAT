# Corrección AURA — diagnóstico de fallos del proveedor

Fecha: 20 de noviembre de 2026 (hora de El Salvador).

## Incidencia observada
Durante la demostración de asignación del turno #28, AURA respondió dos veces «El proveedor de IA no está disponible temporalmente» (20:15 y 20:18). Los registros Render mostraban únicamente `causa=PROVEEDOR`, porque el backend ocultaba todos los HTTP distintos de 401, 403 y 429 detrás del mismo código. Por ello **no se puede afirmar que Groq agotó su cuota**, ni determinar el HTTP exacto ocurrido en estas solicitudes históricas.

En Neon, la consulta SQL confirmó que el requerimiento #28 no tenía asignaciones al momento de la comprobación. No se ejecutó ningún cambio por estos errores.

## Corrección
- Clasificar errores por código HTTP y por tipo/código estructurado seguro del proveedor: `LIMITE` (429), `CREDENCIAL` (401/403), `HERRAMIENTA_INVALIDA` (400/422 con `failed_generation` o `tool_use_failed`), `SOLICITUD_INVALIDA` (otros 400) y `NO_DISPONIBLE` (red/servidor).
- Para **una llamada a función inválida identificada** de Groq, reintentar **solo una vez** la misma solicitud con indicación para construir JSON válido y mayor límite de salida. No reintentar por límites gratuitos, credenciales o problemas ajenos a generación de función.
- Conservar el proveedor Groq. **Nunca** recurrir a OpenAI facturable.
- Render registra únicamente estado HTTP, clasificación y códigos de tipo restringidos a caracteres seguros. **No registra** el cuerpo de error, `failed_generation`, prompts, claves ni respuestas sensibles.
- UI recibe un error accionable sin exponer contenido del proveedor.
- Cinco pruebas nuevas comprueban clasificación y prevención de divulgación de datos.

## Validación
Pruebas de compilación y unitarias de GitHub Actions; verificar antes de fusionar. Después de publicar, reproducir desde SIGPMAT la petición de preparación de asignación para el turno #28 y consultar Render si vuelve a fallar. La causa histórica exacta no se puede reconstruir solo desde los logs antiguos.

## Fuentes del proveedor
- https://console.groq.com/docs/errors
- https://console.groq.com/docs/tool-use/local-tool-calling

**No modificar Neon ni crear asignaciones automáticamente** durante el diagnóstico.
