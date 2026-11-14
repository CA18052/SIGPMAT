# Publicación gratuita de SIGPMAT

El código está preparado para un servicio web de Render y una base PostgreSQL de Neon. La aplicación todavía no tendrá una URL pública hasta que se creen ambos recursos en sus respectivas cuentas.

Trabajaremos con **datos ficticios**. La base del Mac seguirá siendo independiente y no se modificará.

## 1. Crear el proyecto en Neon

1. Entrar en https://console.neon.tech/ e iniciar sesión. Elegir el plan **Free**.
2. Crear un proyecto llamado `sigpmat-demo`, con base de datos `neondb`. Elegir PostgreSQL 18 cuando esté disponible.
3. En **Roles**, crear un nuevo rol PostgreSQL llamado exactamente `sigpmat_app`. Guardar su contraseña fuera de GitHub.
4. Abrir el panel **Connect** y obtener dos cadenas de conexión **directas (no pooled)** a la base `neondb`: una del propietario del proyecto y otra de `sigpmat_app`. No copiarlas en el chat.

### Instalar la base desde el Mac

PostgreSQL 18 ya está instalado con Homebrew en nuestro entorno de desarrollo. Desde una Terminal:

```bash
cd "$HOME/Documents/SIGPMAT/GitHub_publicacion"
git pull --ff-only origin main
cd backend
npm ci
cd ..
bash scripts/configurar_neon_mac.sh
```

El script solicitará ambas conexiones sin mostrarlas, comprobará que pertenecen a Neon y ejecutará las migraciones en orden:

- Creación de las 24 tablas y relaciones.
- Permisos de `sigpmat_app`.
- Roles funcionales de SIGPMAT.
- Disparadores de integridad de los turnos.
- Departamentos, cargos, especialidades y empleados de ensayo.
- Creación de `admin.demo` y `jefe.demo` con contraseñas que introducirás tú mismo.

**Importante:** el script solo debe ejecutarse una vez sobre un proyecto Neon nuevo. Si se interrumpe, no volver a ejecutarlo sin revisar el estado de las tablas. No subas a GitHub ni compartas las conexiones.

Para pruebas de desarrollo se utiliza el usuario limitado `sigpmat_app`. La conexión del propietario se usa únicamente durante las migraciones.

## 2. Crear la aplicación en Render

1. Entrar en https://dashboard.render.com/ e iniciar sesión. Elegir el plan **Free** para el servicio web.
2. Usar **New → Blueprint** y conectar `https://github.com/CA18052/SIGPMAT`.
3. El archivo `render.yaml` indica el servicio `sigpmat-demo`, Node.js 24, los comandos de compilación y la ruta de comprobación.
4. Configurar estas dos variables **secretas**:
   - `DATABASE_URL`: cadena de conexión de **sigpmat_app**, obtenida en Neon, base `neondb`.
   - `JWT_SECRET`: un valor hexadecimal de **96 caracteres**, generado en el Mac con:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

También se establecerán `NODE_ENV=production` y `NODE_VERSION=24` mediante el Blueprint. Los secretos solo se guardan en el panel privado de Render, no en el repositorio.

5. Crear el servicio y comprobar que su despliegue llega a **Live**.
6. Abrir la URL `https://...onrender.com` que Render haya asignado y consultar `/api/health`. Debe responder con JSON y `status: ok`.
7. Abrir la página principal, iniciar sesión con `admin.demo` y probar el registro de un empleado ficticio y un turno. Repetir con `jefe.demo` para comprobar que solo ve su área.

### Si no aparece el Blueprint

Crear un **Web Service** manualmente vinculado a `CA18052/SIGPMAT`, rama `main`:

| Ajuste | Valor |
|---|---|
| Runtime | Node |
| Plan | Free |
| Root Directory | Dejar vacío (raíz del repositorio) |
| Build Command | `npm ci --include=dev --prefix backend && npm install --include=dev --prefix frontend --no-audit --no-fund && npm run build --prefix frontend && npm run build --prefix backend` |
| Start Command | `node backend/dist/server.js` |
| Health Check Path | `/api/health` |

Establecer además `NODE_ENV=production`, `NODE_VERSION=24`, `DATABASE_URL` y `JWT_SECRET`. Render proporciona `PORT` y la aplicación se enlaza a `0.0.0.0`.

## 3. Qué ocurre con los datos

- Neon mantiene su base en almacenamiento persistente independiente del proceso Node.js.
- Render puede detener la aplicación cuando no recibe visitas durante 15 minutos; la siguiente visita podría tardar alrededor de un minuto en activarla.
- **La suspensión de Render no elimina la base de Neon.**
- Los registros creados en Neon no aparecen automáticamente en tu PostgreSQL local, ni viceversa.
- Una base gratuita no sustituye copias de seguridad. Mantener el respaldo del Mac.

## 4. Comprobaciones antes de enseñar el enlace al docente

- `/api/health` responde `200`.
- La pantalla de login aparece correctamente.
- La cuenta `admin.demo` accede y consulta departamentos y personal ficticio.
- La cuenta `jefe.demo` solo puede gestionar su departamento.
- Crear un turno, asignar personal y comprobar el rechazo de conflictos.
- Verificar que `/api/health/db` exige autenticación de administrador.
- Revisar los logs de Render sin publicar tokens ni contraseñas.
- Probar también la ejecución local como respaldo para el día de la defensa.

**SIGPMAT es un proyecto académico:** no se ha endurecido ni auditado para uso hospitalario real. Nunca introducir datos reales de pacientes ni empleados.

## Referencias técnicas

- Render, despliegues gratuitos: https://render.com/docs/free
- Render, servicios web y puertos: https://render.com/docs/web-services
- Neon, información sobre su plan gratuito: https://neon.com/blog/neon-free-plan-1-gb-per-project
- Neon, verificación TLS en PostgreSQL: https://neon.com/blog/avoid-mitm-attacks-with-psql-postgres-16
