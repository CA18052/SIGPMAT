# Propuesta de despliegue sin costo de suscripción

## Opción principal (por implementar)

- **GitHub Free:** repositorio público sin secretos ni datos reales.
- **Render Free:** un servicio web de Node.js/Fastify que sirva la API y el frontend compilado en una misma URL. Puede detenerse tras 15 minutos sin tráfico y tardar en reiniciar; no es apto para producción.
- **Neon Free:** PostgreSQL gestionado para demostración, separado de la BD local. Los límites gratuitos pueden cambiar; comprobarlos antes del despliegue.

Ventaja: una URL pública para el docente, sin Docker y sin problemas de CORS entre distintos dominios.

## Ajustes técnicos necesarios

1. Adaptar Fastify a `process.env.PORT` y escuchar en `0.0.0.0` en hospedaje; conservar `127.0.0.1` en desarrollo.
2. Servir el `frontend/dist` desde Fastify con ruta fallback para React Router.
3. Configurar PostgreSQL remoto con TLS y credenciales solo en variables de entorno de Render; nunca en el frontend ni en GitHub.
4. Ejecutar migraciones sobre una BD aislada de demostración y crear usuarios ficticios con contraseñas nuevas.
5. Proteger endpoints diagnósticos, errores, logs y encabezados HTTP; revisar límites de login y expiración de sesión.
6. Probar la URL pública y la ruta de recuperación local antes de la defensa.

## Respaldo obligatorio

Conservar el Mac con PostgreSQL y Fastify instalados y una copia local del frontend compilado. Si Render duerme o Neon no responde, ejecutar la demostración directamente en el Mac, incluyendo alta, consulta, modificación y reglas de turnos.

## Nota de seguridad

Este despliegue es únicamente académico y con datos sintéticos. No utilizar información real de personal médico ni pacientes. Docker Desktop dispone de uso gratuito educativo, pero **Docker no es necesario** para este diseño.
