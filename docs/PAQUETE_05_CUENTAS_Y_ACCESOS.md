# Paquete 05 — Cuentas individuales y acceso del docente

## Alcance implementado

- Cuenta original `admin.demo`: **único superadministrador** del sistema. Los demás administradores no pueden crear usuarios, bloquear cuentas, restablecer claves ni acceder a la futura auditoría global.
- Cuentas de **integrantes**: se identifican por carnet UES; el administrador introduce el número real, sin inventarlo. Patrón orientativo aceptado: 2–4 letras y 4–8 dígitos (por ejemplo, `AB12345`). No se deben publicar carnets ni credenciales en un repositorio público.
- Cuenta de **docente evaluador**: nombre de usuario definido por el equipo, con el rol operativo `ADMIN_GENERAL` para explorar los módulos hospitalarios, **sin privilegio de superadministrador**.
- Administración exclusiva de superadmin: alta, listado, bloqueo/habilitación y restablecimiento de claves; la cuenta superadmin no se puede bloquear ni restablecer desde ese panel.
- Contraseñas: Argon2id; clave aleatoria segura generada por Node `crypto.randomBytes` o clave manual de 12 a 128 caracteres. La clave generada se muestra **una sola vez**, no se guarda en el frontend ni se registra en el historial.
- **Cambio obligatorio en primer ingreso:** los usuarios con contraseña temporal no pueden usar API de negocios antes de cambiarla. La clave debe renovarse con la contraseña actual.
- **Revocación de sesiones:** cambiar/restablecer clave o bloquear/habilitar cuenta incrementa `sesion_version` y revoca inmediatamente los JWT previos. Cada petición protegida consulta el estado, versión y roles vigentes.
- Las sesiones mantienen vencimiento de **15 minutos** y se conservan únicamente en la pestaña del navegador al recargar.

## Protección contra registro abierto

No hay un endpoint público que conceda accesos administrativos a visitantes. La página de inicio de sesión explica que las cuentas son proporcionadas por el superadministrador. La opción de invitaciones/registro por token de un solo uso es una mejora futura que requiere un flujo de verificación separado; no está implementada en este paquete.

## Migración SQL y despliegue

1. **Antes del backend:** crear respaldo de Neon, ejecutar `database/sql/18_cuentas_individuales.sql` en `neondb`, comprobar las columnas nuevas y que únicamente `admin.demo` tenga `es_superadministrador=TRUE`.
2. Comprobar CI del pull request y fusionarlo en `main` solo cuando las pruebas aprueben.
3. Render usa **despliegue manual por decisión del equipo**. Entrar al servicio en Render y ejecutar **Manual Deploy → Deploy latest commit** sobre el commit aprobado en `main`.
4. Tras recibir `Live`, iniciar con `admin.demo`, abrir **Usuarios**, crear los cuatro integrantes restantes por sus carnets reales. La cuenta personal del superadmin será la quinta identidad operativa del equipo mientras así lo prefiera el propietario.
5. Crear cuenta docente con usuario acordado, nombre visible y contraseña temporal. Entregar credenciales **en privado**; nunca incluir la contraseña administrativa en el PDF de entrega.
6. Para cada cuenta creada, entrar y cambiar la contraseña obligatoriamente; cerrar sesión y entrar de nuevo. Probar que cada miembro puede operar módulos hospitalarios pero **no** administrar usuarios.
7. Bloquear temporalmente una cuenta de ensayo y comprobar que pierde acceso; habilitarla desde `admin.demo`.

**Atención:** la migración SQL debe preceder la publicación del backend que la necesita. No reejecutar el script de estructura inicial sobre la base ya existente.

## Pruebas y limitaciones

- Aplicar primero en rama de ensayo Neon; comprobar tablas, roles y acceso original.
- El frontend y el backend compilan mediante GitHub Actions; esas pruebas no sustituyen las pruebas con credenciales reales.
- Las cuentas **no se crean automáticamente** hasta que el superadmin introduzca carnets, nombre y claves.
- No se modifica la cuenta `jefe.demo` ni sus vínculos; se conserva como rol limitado.
- La reautenticación para *cada* operación CRUD y la bitácora global pertenecen al **Paquete 06**. No afirmar que ya existen en el Paquete 05.
- Como los correos son opcionales en el formulario, cuando se omiten se genera un identificador interno `@sigpmat.invalid`; no se envían correos de invitación o recuperación. Se debe entregar la clave temporal mediante un canal privado.
- El nombre de usuario del docente se transforma a mayúsculas al crearlo; se recomienda una etiqueta clara como `DOCENTE.EVALUADOR`.

## Contribución a la defensa

Mostrar que cada integrante opera con identidad independiente, que el docente tiene credenciales propias, que la cuenta superadmin gestiona altas y accesos, que las claves se almacenan con Argon2id y que una sesión se revoca tras cambiar la contraseña. No compartir ninguna clave ni token en capturas o PDFs.

**Estado:** módulo desarrollado en la rama de trabajo. La verificación de CI, migración a Neon main y publicación manual deben anotarse con su estado real al finalizar el paquete.
