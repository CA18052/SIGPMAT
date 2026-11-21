# Paquete 09 — AURA, copiloto inteligente de SIGPMAT

## Actualización — proveedor gratuito GroqCloud (noviembre 2026)

**Decisión del equipo:** AURA utiliza **GroqCloud Free** por defecto, sin requerir pagos, tarjeta ni créditos de la API de OpenAI. El modelo predeterminado es `openai/gpt-oss-20b`, modelo de pesos abiertos servido por Groq, no por ChatGPT. Es una IA generativa real con llamadas a funciones. La cuota gratuita está limitada por solicitudes y tokens: consultar los límites vigentes de la cuenta Groq.

**Compatibilidad:** Groq expone una implementación de Responses API con soporte para Function Calling, por lo que se preservan todas las funciones y controles de AURA. La implementación elimina el parámetro `store` al utilizar Groq porque su Responses API aún no lo admite. El historial se conserva solo en la sesión del frontend, como ya ocurría.

**Variables privadas de Render:**
- `GROQ_API_KEY`: obligatoria para el modo gratuito. Se genera en https://console.groq.com/keys y se introduce **solo** en Render → Environment.
- `AURA_PROVEEDOR=groq`: predeterminada; puede omitirse si la instalación no tiene valor explícito.
- `GROQ_MODEL=openai/gpt-oss-20b`: opcional, modelo predeterminado.
- `OPENAI_API_KEY`: **no se utiliza** mientras el proveedor sea Groq. Solo se usa si se establece expresamente `AURA_PROVEEDOR=openai`, lo que puede generar facturación.

**No existe fallback de pago**: si Groq no tiene clave o se agota su cuota gratuita, AURA muestra un error; nunca pasa automáticamente a OpenAI. Para continuar gratis, conservar la cuenta Groq en su plan Free y no ascender voluntariamente al plan Developer.

**Prueba pendiente:** crear cuenta y clave Groq privada, desplegar, comprobar chat real y Function Calling en la web. Sin esa clave no puede afirmarse que la integración externa está probada. En bases médicas reales, revisar normas de privacidad y procesamiento antes de enviar datos a terceros.

**Fuentes técnicas:**
- Groq Responses API: https://console.groq.com/docs/responses-api
- Groq Free Limits: https://console.groq.com/docs/rate-limits
- Groq Tool Use: https://console.groq.com/docs/tool-use/local-tool-calling
- Groq Privacy: https://console.groq.com/docs/your-data

---


Fecha: 20 de noviembre de 2026. Documentación técnica basada en el código integrado del proyecto.

## 1. Qué es AURA

**AURA** significa *Asistente Unificado de Recursos y Asignaciones*. Es un copiloto en React que utiliza **Responses API compatible de GroqCloud**, modelo predeterminado **`openai/gpt-oss-20b`** y **Function Calling** para solicitar operaciones expresamente autorizadas a Fastify. No es una conversación con ChatGPT Plus ni un modelo alojado en PostgreSQL.

- La interfaz muestra el acceso a AURA desde el menú y mediante un botón flotante, con diseño móvil.
- El backend `backend/src/aura/routes.ts` expone:
  - `GET /api/aura/estado` para conocer si existe la clave de proveedor.
  - `POST /api/aura/mensaje` con la conversación de longitud limitada, sin persistencia del historial en la base de datos.
  - `POST /api/aura/ejecutar` para ejecutar **una propuesta aprobada por el usuario con contraseña**.
- El modelo puede pedir funciones de catálogo, cobertura, turnos, disponibilidad por intervalo, recomendaciones de turnos existentes y creación de *borradores* de empleados, turnos y asignaciones.

## 2. Tres niveles de capacidad

1. **Consultar:** permite preguntas naturales sobre departamentos, cobertura, turnos y personal elegible por cargo, departamento, especialidad y horario.
2. **Preparar propuestas:** puede generar un borrador de turno, empleado o asignación sin modificar datos. AURA NO presenta acciones como guardadas antes de que el usuario las apruebe.
3. **Ejecutar supervisadamente:** el usuario pulsa «Revisar y ejecutar» y aprueba; el frontend invoca la confirmación de contraseña existente en el Paquete 06; Fastify verifica el comprobante de un uso y el ticket de propuesta firmado, y finalmente invoca el **endpoint de negocio existente**, con sus validaciones RBAC y triggers.

Un pedido complejo «crea un turno y asígnale profesionales» se ejecuta **por etapas**: primero crear y confirmar turno; luego consultar elegibilidad y aprobar cada asignación. Esto preserva la confirmación por operación del Paquete 06 y evita inserciones múltiples parcialmente confirmadas.

### Funciones disponibles en la API del modelo

| Función | Permiso | Efecto |
|---|---|---|
| `consultar_catalogos` | Usuario autenticado autorizado | Consulta IDs y nombres válidos |
| `consultar_cobertura` | Administrador, jefe o visitante | Resumen agregado, según el área |
| `buscar_turnos` | Administrador, jefe o visitante | Consulta turnos en su ámbito |
| `consultar_recomendaciones_turno` | Administrador o jefe | Recomendaciones del Paquete 08 |
| `buscar_personal_disponible` | Perfil con acceso al departamento | Consulta hasta 12 elegibles sin datos de contacto |
| `preparar_turno` | Administrador o jefe | Emite propuesta firmada, sin escribir |
| `preparar_empleado` | Solo ADMIN_GENERAL | Emite propuesta firmada, sin escribir |
| `preparar_asignacion` | Administrador o jefe | Emite propuesta firmada, sin escribir |

No hay herramienta de SQL libre ni acceso directo de OpenAI a Neon.

## 3. Seguridad

- Cada función verifica la identidad y el rol con los mecanismos existentes. El modelo no puede elevar permisos.
- Un visitante puede consultar datos autorizados, pero nunca preparar ni ejecutar operaciones.
- Los documentos (DUI, teléfonos, correos), contraseñas y tokens no forman parte del contexto de AURA; la API rechaza entradas con esos formatos. Los datos sensibles deben capturarse directamente en formularios protegidos.
- Los tickets de propuesta se firman con HMAC-SHA256 usando `JWT_SECRET` del servidor y se vinculan al usuario, tipo, ruta y datos; vencen en cinco minutos. Se controla su **uso único** con `sigpmat.confirmaciones_operacion`.
- La ruta `/api/aura/ejecutar` **sí requiere** la reautenticación del Paquete 06; el endpoint de lectura `/api/aura/mensaje` está exceptuado de contraseña adicional.
- Al ejecutar, el servidor genera una confirmación interna de un solo uso para invocar el endpoint de negocio original por medio de `app.inject`. **No hay inserciones de personal o turnos realizadas directamente por el modelo**.
- Las asignaciones se revalidan mediante triggers PostgreSQL en el momento de guardarlas. Una propuesta puede dejar de ser elegible mientras está en pantalla.
- La auditoría registra la ejecución exterior y la operación de negocio concreta; no se registran contraseñas ni el contenido del chat.
- Conversación: máximo ocho mensajes anteriores, hasta 1500 caracteres por solicitud. OpenAI se utiliza con `store:false`. Esto no elimina las políticas externas del proveedor.
- Se limita el uso a seis mensajes por minuto y cinco ejecuciones por minuto por protección adicional frente a errores y costos. El límite de tokens de salida por solicitud es 850.
- Si el proveedor no responde, el sistema sigue funcionando sin AURA. No se generan respuestas ficticias como sustituto.

## 4. Configuración necesaria en Render

**El código NO contiene ni inventa una clave de OpenAI.** Una suscripción a ChatGPT no constituye una clave de API.

1. Crear un proyecto y configurar facturación/límites de gasto en <https://platform.openai.com/>.
2. Obtener una clave del proyecto con acceso a Responses API.
3. Abrir Render → servicio **sigpmat-demo** → **Environment** y añadir:
   - `OPENAI_API_KEY`: clave secreta del proyecto (nunca en GitHub, frontend, PDF ni chat).
   - `OPENAI_MODEL`: opcional; predeterminado `gpt-4.1-mini`.
4. Guardar y desplegar el servicio con las variables. Si Render ya construyó el commit pero aún no tenía la clave, es necesario un nuevo despliegue o reinicio con el entorno actualizado.
5. Iniciar sesión en SIGPMAT, abrir AURA y comprobar que `/api/aura/estado` indica `habilitada:true`.
6. Hacer consultas reales con datos ficticios, comprobar que las herramientas funcionan y probar una sola operación de ensayo con confirmación.

**Advertencia:** no introducir la clave en un chat ni adjuntarla al proyecto universitario. La facturación de API es independiente de ChatGPT Plus.

## 5. Preguntas para la defensa

**¿Es una IA real?** Sí, **solo después de configurar la API y verificar una respuesta real**. Se usa un modelo externo de lenguaje con Function Calling para comprender solicitudes. La elegibilidad se calcula mediante reglas y consultas de PostgreSQL, no mediante el modelo.

**¿Puede crear turnos y asignar personal automáticamente?** Puede preparar una propuesta y ejecutar **cada acción** después de que la persona revise y confirme su contraseña. No ejecuta lotes arbitrarios sin autorización y no reemplaza a los responsables hospitalarios.

**¿Cómo evita filtrar datos?** Fastify decide qué herramienta puede usar cada cuenta y devuelve únicamente campos mínimos. La clave de OpenAI permanece exclusivamente en Render.

**¿Cómo responde a un turno «mañana mixto»?** Usa la fecha local de El Salvador; pide horas precisas, departamento, cargo y cupos si están incompletos. No inventa horarios de «mixto».

**¿Puede equivocarse?** Sí. El modelo puede interpretar mal una intención y los datos pueden cambiar. La vista previa humana y la revalidación del backend reducen riesgos; no son garantías absolutas.

## 6. Evidencia que falta recabar

- CI de frontend y backend, y pruebas unitarias de tickets firmados.
- Configurar clave privada y verificar respuesta de OpenAI en Render.
- Probar casos de lectura con admin, jefe y visitante; probar denegación de escritura a visitante.
- Preparar turno con datos de ensayo → revisar → confirmar contraseña → comprobar DB + auditoría.
- Probar asignación a personal elegible; simular un cambio de disponibilidad antes del guardado y comprobar rechazo.
- Probar clave del proveedor ausente/incorrecta y rate limit.

**No afirmar en el documento final que estas pruebas E2E están ejecutadas si no lo están.**

## 7. Fuentes técnicas oficiales

- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses/create
- Function Calling: https://platform.openai.com/docs/guides/function-calling
- Modelo elegido: https://platform.openai.com/docs/models/gpt-4.1-mini
- Variables privadas Render: https://render.com/docs/configure-environment-variables
