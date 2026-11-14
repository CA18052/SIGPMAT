# SIGPMAT

**Sistema Integral de Gestión de Personal Médico y Asignación de Turnos Hospitalarios**
Proyecto académico — Análisis y Diseño de Software II, Universidad de El Salvador (2026).

> **Estado del repositorio:** línea base del backend v0.5 y de PostgreSQL. La interfaz web y el módulo completo de turnos se implementarán como parte de la entrega final. No se deben interpretar los prototipos como funciones terminadas.

## Tecnologías

- Backend: Node.js 24 LTS, TypeScript, Fastify 5, JWT, Argon2id, `pg`.
- Persistencia: PostgreSQL 18, esquema `sigpmat`.
- Frontend previsto: React, TypeScript y Vite.
- Automatización: GitHub Actions para compilar y verificar tipos.

## Organización

- `backend/`: API y scripts de comprobación existentes (v0.5).
- `database/sql/`: migraciones, verificaciones y datos ficticios.
- `frontend/`: código React por incorporar.
- `docs/`: matriz de evaluación, hoja de ruta y propuesta de despliegue.

## Ejecución local de la API

1. Instalar PostgreSQL 18 y Node.js 24 LTS.
2. Crear roles y base de datos conforme a `docs/CONFIGURACION_LOCAL.md`.
3. Ejecutar los scripts SQL indicados en `database/sql/` en orden.
4. Copiar `backend/.env.example` a `backend/.env`, establecer contraseñas propias y generar un secreto JWT; **nunca subir `.env`**.
5. Ejecutar:

```bash
cd backend
npm ci
npm run typecheck
npm run build
npm run dev
```

La API escucha originalmente en `http://127.0.0.1:3001` (requiere ajustes para el despliegue público). Verificar `GET /api/health` y `GET /api/health/db`.

## Seguridad y privacidad

Todos los datos de demostración son ficticios. No publicar información real de pacientes o empleados, credenciales, tokens, archivos `.env` o capturas que revelen datos personales. Las operaciones se encuentran en desarrollo académico, **no son aptas para operar un hospital real**.

## Entrega final

La consigna de la UES establece la entrega del PDF técnico y del software funcional para el **20 de noviembre de 2026 a las 11:55 p. m.**. La fecha de exposición es independiente y debe confirmarse con el docente. Consultar `docs/PLAN_ENTREGA_FINAL.md`.
