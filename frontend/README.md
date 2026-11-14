# SIGPMAT — Interfaz web v0.1

Aplicación React + TypeScript + Vite conectada a la API Fastify de SIGPMAT.

## Funciones disponibles

- Inicio de sesión con las credenciales creadas en PostgreSQL.
- Panel con métricas de departamentos y empleados visibles.
- Búsqueda y filtrado de empleados por departamento.
- Vista de detalle del empleado y especialidades acreditadas.
- Listado de departamentos y personal adscrito.
- Edición de nombres y apellidos para ADMIN_GENERAL.
- Restricción de navegación y operaciones basada en las respuestas HTTP del backend.

**Importante:** no se muestran cifras ficticias en el dashboard; los datos vienen de las rutas reales de la API. Los módulos visuales de turnos y asignaciones aún no están implementados.

## Requisitos

Node.js 24 LTS, npm y el backend Fastify v0.5 en ejecución sobre http://127.0.0.1:3001.

## Ejecución local

Desde la raíz del repositorio:

```bash
cd backend
npm install
npm run dev
```

Abre otra Terminal:

```bash
cd frontend
npm install
npm run dev
```

Accede a **http://127.0.0.1:5173**. Vite redirige todas las solicitudes `/api` a Fastify en el puerto 3001.

Utiliza una cuenta de desarrollo previamente creada, por ejemplo `admin.dev`. Las contraseñas no deben añadirse al repositorio.

## Validación

```bash
cd frontend
npm run typecheck
npm run build
```

## Seguridad y limitaciones

- El JWT se mantiene exclusivamente en memoria mientras está abierta la aplicación; no se persiste en `localStorage`.
- El backend sigue siendo la fuente de verdad para permisos por rol y departamento.
- La sesión termina al recargar la página y los tokens expiran según la API.
- El listado actual del backend tiene un límite de 100 empleados por solicitud. No es una estadística global del hospital.
- Se trata de un prototipo académico funcional sujeto a validación local e integración adicional; no está listo para uso clínico o despliegue público sin endurecimiento.
