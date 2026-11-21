# SIGPMAT

**Sistema Integral de Gestión de Personal Médico y Asignación de Turnos Hospitalarios**

SIGPMAT permite consultar el directorio médico, organizar turnos por departamento y comprobar qué plazas siguen sin cubrir. Es la aplicación del proyecto de **Análisis y Diseño de Software II** de la Universidad de El Salvador, Facultad Multidisciplinaria de Occidente, ciclo II-2026. La demostración utiliza registros ficticios.

## Acceso a la demostración

1. Abre [SIGPMAT en Render](https://sigpmat-demo.onrender.com/). Si aparece la pantalla de carga de Render, mantén la pestaña abierta hasta que veas la bienvenida de SIGPMAT.
2. Inicia sesión con la cuenta asignada. Para explorar el sistema como visitante, selecciona **Crear cuenta de lectura**.
3. Abre **Turnos**, selecciona un turno y revisa el departamento, las plazas requeridas y el personal asignado. En **Reportes y análisis** puedes consultar la cobertura de varios turnos en un intervalo de fechas.

## Funciones de la aplicación

| Módulo | Qué permite hacer |
| --- | --- |
| Personal y departamentos | Buscar empleados por nombre o código, filtrar por departamento, cargo y estado, y consultar especialidades y adscripciones. Los perfiles autorizados pueden administrar estos registros. |
| Turnos y asignaciones | Crear turnos, definir los perfiles requeridos, consultar vacantes y asignar personal. La opción **Proponer personal** sugiere candidatos compatibles según sus credenciales, disponibilidad y carga reciente. |
| Reportes y análisis | Consultar plazas cubiertas y pendientes por departamento y período, exportar resultados a CSV e imprimir o guardar el reporte como PDF. |
| Accesos y auditoría | Limitar las consultas y operaciones según el rol. Las operaciones protegidas exigen confirmar la identidad. La bitácora permite al superadministrador revisar quién realizó una acción y con qué resultado. |

### AURA, asistente de recursos y asignaciones

AURA integra un modelo de lenguaje a través de la API de Groq. Desde el asistente se pueden hacer preguntas sobre el sistema o describir una tarea en español. Por ejemplo, se le puede pedir que prepare un turno diurno de Cirugía General con una plaza de especialista y muestre la propuesta para revisión.

Preparar la propuesta y guardarla son dos pasos distintos. El usuario revisa los datos y confirma con su contraseña. Al guardar, la API comprueba los permisos y PostgreSQL valida las reglas de integridad. Si se agota la cuota gratuita de IA, los módulos de la aplicación siguen disponibles para trabajar de forma manual.

## Ejecución local

Se requieren **Node.js 24**, **PostgreSQL 18** y una base de desarrollo preparada. La [guía de configuración local](docs/CONFIGURACION_LOCAL.md) describe los roles, el esquema inicial y los datos ficticios. Para una instalación nueva, revisa también las migraciones posteriores de [database/sql](database/sql/), incluidas las de permisos de edición y eliminación, cuentas individuales, reautenticación y auditoría. Los scripts de prueba y diagnóstico tienen fines distintos de las migraciones.

Desde la raíz del repositorio, configura la API en una primera terminal:

```bash
cd backend
cp .env.example .env
```

Edita `.env` con la conexión de desarrollo (`DATABASE_URL`) y un secreto de sesión propio (`JWT_SECRET`). Para usar AURA en local, configura también `GROQ_API_KEY`. Después, en esa misma terminal, inicia la API:

```bash
npm ci
npm run dev
```

En una segunda terminal, desde la raíz, inicia la interfaz:

```bash
cd frontend
npm install
npm run dev
```

Abre la [interfaz local](http://127.0.0.1:5173). Para comprobar por separado que la API responde, consulta su [endpoint de salud](http://127.0.0.1:3001/api/health).

## Estructura del repositorio

| Ruta | Contenido |
| --- | --- |
| [frontend/](frontend/) | Interfaz web en React, TypeScript y Vite. |
| [backend/](backend/) | API en Fastify y TypeScript, autenticación, integración de AURA y pruebas. |
| [database/sql/](database/sql/) | Esquema PostgreSQL, migraciones, datos ficticios y consultas de verificación. |
| [database/neon/](database/neon/) | Scripts adaptados al entorno de PostgreSQL en Neon. |
| [scripts/](scripts/) | Utilidades de apoyo al proyecto. |
| [docs/](docs/) | Guías técnicas y registros de verificación. |
| [render.yaml](render.yaml) | Configuración del servicio en Render. Consulta la [guía de despliegue](docs/DESPLIEGUE_GRATUITO.md). |

## Verificación del código

Con las dependencias instaladas, ejecuta desde la raíz:

```bash
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix backend run test:aura
npm --prefix frontend run build
npm --prefix frontend run test:session
npm --prefix frontend run test:aura-markdown
```

Las credenciales de acceso a la demostración se entregan por separado. Utiliza datos ficticios para las pruebas y conserva las claves en las variables de entorno de cada instalación.
