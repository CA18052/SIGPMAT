# Seguridad y datos de ensayo

SIGPMAT es un proyecto académico, no un sistema autorizado para uso clínico ni para operar un hospital real.

- Utilizar únicamente datos ficticios durante la demostración.
- No publicar credenciales, secretos JWT, tokens, archivos `.env`, respaldos con datos reales ni información personal.
- Mantener autenticación y autorización en el backend, no únicamente en React.
- Verificar el alcance departamental y los permisos antes de consultar o modificar datos.
- Crear credenciales diferentes para cada instalación.
- Comprobar errores, validaciones, pruebas de integración y configuración de despliegue antes de exponer el servicio a internet.
- Los archivos `.env.example` son plantillas sin contraseñas reales.
