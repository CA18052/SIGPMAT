# SIGPMAT

**Sistema Integral de Gestión de Personal Médico y Asignación de Turnos Hospitalarios**

Proyecto de Análisis y Diseño de Software II, Universidad de El Salvador, ciclo II-2026.

SIGPMAT busca facilitar el registro del personal médico y la organización de los turnos hospitalarios. Este repositorio reúne el código de la aplicación, la estructura de la base de datos y las pruebas que hemos desarrollado durante la asignatura.

## Qué funciona hasta ahora

- Base de datos PostgreSQL 18 con 24 tablas y reglas de integridad.
- API en Fastify y TypeScript: inicio de sesión, roles, departamentos, empleados, especialidades y traslados.
- Interfaz React: inicio de sesión, panel principal, consultas de personal y departamentos, edición básica de empleados y pantalla de turnos.
- API de turnos: creación, consulta, asignación manual y cancelación controlada. Las rutas están implementadas y compilan; falta validar el recorrido completo en la base local.
- Pruebas SQL y de API, además de compilación automática en GitHub Actions.

La gestión básica de turnos ya está integrada en el código. La asignación automática sigue pendiente y las operaciones nuevas deben verificarse con PostgreSQL. El proyecto todavía no está preparado para usarse en un hospital real.

## Estructura

- `backend/`: API y scripts de prueba.
- `database/sql/`: creación de tablas, reglas de integridad, consultas de verificación y datos de prueba.
- `frontend/`: aplicación web con React, TypeScript y Vite.
- `docs/`: instrucciones de instalación y documentación del proyecto.

## Cómo ejecutarlo

Se necesita Node.js 24 y PostgreSQL 18. Antes de iniciar la aplicación hay que preparar la base de datos siguiendo `docs/CONFIGURACION_LOCAL.md`.

En `backend/`, crea un archivo `.env` a partir de `.env.example` y coloca las credenciales de tu instalación.

Primera Terminal:

```bash
cd backend
npm ci
npm run dev
```

Segunda Terminal:

```bash
cd frontend
npm install
npm run dev
```

La aplicación se abre en `http://127.0.0.1:5173`. El frontend envía las peticiones `/api` al backend, que corre en `http://127.0.0.1:3001`.

Para comprobar que el código compila:

```bash
cd backend
npm run typecheck && npm run build

cd ../frontend
npm run build
```

## Datos de prueba

El proyecto utiliza cuentas y registros ficticios. No deben subirse archivos `.env`, contraseñas, tokens ni respaldos con información personal.

## Entrega

El plazo indicado para el proyecto final es el **20 de noviembre de 2026 a las 11:55 p. m.**. Además del código, se entregará el informe técnico en PDF y se realizará una demostración del sistema.
