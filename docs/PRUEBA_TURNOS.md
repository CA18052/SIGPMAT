# Cómo probar la gestión de turnos

La pantalla de turnos ya está integrada en el frontend y las rutas están en la API. Antes de dar esta parte por terminada, falta comprobar las operaciones con PostgreSQL.

## Preparación

Se necesita la base `sigpmat_dev` con las migraciones 01–08 y los datos ficticios del primer avance. PostgreSQL, Fastify y Vite deben estar encendidos.

Los comandos se ejecutan desde la raíz del repositorio clonado.

```bash
cd backend
npm run typecheck && npm run build
npm run dev
```

En otra Terminal:

```bash
cd frontend
npm install
npm run build
npm run dev
```

La interfaz estará en `http://127.0.0.1:5173`.

## Prueba manual

1. Iniciar sesión como `admin.dev`.
2. Abrir **Turnos y cobertura** en el menú lateral.
3. Crear un turno futuro para el Departamento A, con un cargo activo y un cupo.
4. Abrir el detalle del turno y asignar un empleado con ese cargo que esté adscrito al área.
5. Intentar asignar nuevamente a la misma persona. Debe rechazarse la duplicación.
6. Intentar cancelar el turno mientras tiene una asignación activa. Debe rechazarse.
7. Cancelar primero la asignación y después el turno. Ambos cambios deben quedar guardados.

Para repetir los casos HTTP desde Terminal:

```bash
cd backend
npm run smoke:turnos
```

El script solicita las contraseñas de `admin.dev` y `jefe.dev` sin mostrarlas. Debe finalizar con `PRUEBAS DE TURNOS 15/15 COMPLETADAS`.

**Nota:** esta prueba crea registros de ensayo y los deja cancelados en la base de desarrollo. No debe ejecutarse sobre información real.

## Qué falta revisar

No se han completado todavía la asignación automática, las restricciones de jornada y descanso, la recurrencia semanal de disponibilidad ni una validación de concurrencia bajo carga. Las reglas existentes comprueban sobrecupos, cargos, especialidades, solapamientos y ausencias.
