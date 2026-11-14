# Interfaz web de SIGPMAT

Esta carpeta contiene el frontend hecho con React, TypeScript y Vite. Se conecta con la API de Fastify para consultar y actualizar información de la base de datos.

## Qué se puede probar

- Iniciar sesión con una cuenta creada en la base de datos.
- Ver los empleados y departamentos disponibles para el usuario.
- Buscar empleados y filtrarlos por departamento.
- Consultar el detalle de un empleado y sus especialidades.
- Consultar el personal adscrito a un departamento.
- Modificar nombres y apellidos si la cuenta tiene el rol `ADMIN_GENERAL`.

El panel muestra datos que devuelve la API. Por ahora, las cifras corresponden a los empleados visibles en la consulta, que tiene un límite de 100 registros. Todavía no hemos incorporado las pantallas para crear turnos ni asignar personal a ellos.

## Cómo iniciarlo

Primero hay que tener PostgreSQL en funcionamiento y el backend encendido en el puerto 3001.

En una Terminal:

```bash
cd backend
npm ci
npm run dev
```

En otra:

```bash
cd frontend
npm install
npm run dev
```

Abre `http://127.0.0.1:5173` e inicia sesión con una cuenta de desarrollo, por ejemplo `admin.dev`. La contraseña depende de la instalación local; no se guarda en este repositorio.

Para revisar la compilación:

```bash
cd frontend
npm run build
```

## Algunos detalles

La sesión se mantiene en memoria: al actualizar la página hay que iniciar sesión otra vez. Los permisos se validan en la API; ocultar una opción del menú no reemplaza esos controles. Si el backend está apagado, el frontend no podrá cargar los datos.

Esta versión es parte del proyecto académico. Falta terminar la gestión de turnos y realizar las pruebas completas de la interfaz.
