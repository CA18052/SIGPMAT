# Configuración local — backend v0.5

Esta guía registra la línea base y no instala servicios automáticamente.

## PostgreSQL

Crear los roles PostgreSQL `sigpmat_owner` (propietario del esquema) y `sigpmat_app` (acceso limitado), y la base `sigpmat_dev`, propiedad de `sigpmat_owner`. Utilizar contraseñas **propias**, no las de otro integrante. PostgreSQL debe estar ejecutándose localmente en `127.0.0.1:5432`.

Ejecutar como `sigpmat_owner` los scripts `01`, `02`, `03`, `06`; ejecutar los scripts `04`, `05`, `07`, `08` de verificación/pruebas según su propósito, siempre siguiendo las instrucciones y sin omitir errores. `09` carga datos ficticios; `10` y `11` permiten verificar esa carga. Los scripts 05 y 07 hacen rollback de los datos de prueba.

> **No ejecutar sin revisar** los scripts 01/02 sobre una base existente; fueron diseñados para crear una instalación nueva. Este repositorio contiene la estructura, no las contraseñas ni un volcado de datos reales.

## Configuración local

```bash
cd backend
cp .env.example .env
# Editar .env con las credenciales propias y el secreto JWT.
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
npm ci
npm run typecheck
npm run build
npm run dev
```

En una segunda terminal: `curl http://127.0.0.1:3001/api/health`. Crear `admin.dev` mediante `npm run bootstrap:admin` para la base de desarrollo, si se requieren los escenarios de prueba posteriores. **No publicar claves de las cuentas de ensayo**.

## Pruebas anteriores

La versión v0.5 dispone de scripts `smoke:*` que necesitan datos y cuentas ficticias; no son pruebas unitarias aisladas, ni tienen que volver a pasar sobre datos de otra fecha. No ejecutar `npm test` hasta reemplazar el placeholder original.
