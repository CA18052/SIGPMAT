# Paquete 07 — Verificación del despliegue automático de SIGPMAT

## Estado observado el 20 de noviembre de 2026

- **Servicio Render:** `sigpmat-demo` (web service `srv-dbsdbnjbc2fs73b8ouqg`).
- **Rama enlazada:** `main` del repositorio `CA18052/SIGPMAT`.
- **Ajuste mostrado por la API:** `autoDeploy=yes`; `autoDeployTrigger=checksPass`.
- **Último desplegado antes del cierre del Paquete 07:** `dd397c8e79ba`, `Live` desde el 20/11/2026, disparador **manual**.
- **Eventos reales:** los despliegues de los paquetes anteriores muestran `trigger.manual=true`; no se detectó un evento de despliegue automático en el historial consultado.
- **Comprobaciones de GitHub Actions:** las compilaciones de frontend y backend en `main` habían terminado correctamente.

**Diagnóstico:** la configuración visible solicita publicación después de CI, pero aún NO hay evidencia de que el vínculo GitHub → Render esté activando un despliegue automático. No se ha probado si el servicio se creó mediante la opción Public Git Repository o con la integración autenticada de GitHub. No afirmar una causa que no se verificó.

## Pasos seguros para comprobar y reparar

1. Desde `https://dashboard.render.com/web/srv-dbsdbnjbc2fs73b8ouqg`, entrar en **Settings** y comprobar el origen Git (repo, rama `main`, credenciales y ajustes de Auto-Deploy). No reemplazar el servicio ni crear un nuevo servicio durante la predefensa.
2. Abrir **Render → Account Settings → Git Deployment Credentials**. Comprobar que GitHub está conectado y que las credenciales autorizan el repositorio `CA18052/SIGPMAT`.
3. En GitHub, revisar las instalaciones de la aplicación oficial Render: `https://github.com/apps/render/installations/new`; comprobar **Repository access**. Si la instalación se limita a repositorios seleccionados, incluir SIGPMAT.
4. Comprobar en Render **Auto-Deploy → After CI Checks Pass**. Mantener esta opción, ya que evita publicar commits cuyas comprobaciones fallen.
5. Hacer una modificación pequeña en una rama mediante pull request, esperar compilación satisfactoria y fusionarla en `main`. En **Deploys**, verificar que aparezca un nuevo despliegue **automatic**, con el SHA del nuevo commit.
6. Si no ocurre, documentar el fallo de la integración y utilizar **Manual Deploy → Deploy latest commit** tras comprobar CI. No usar **Deploy a specific commit**, que puede desactivar Auto-Deploy desde el panel de Render.

## Observaciones importantes

- Según Render, **las URL de repositorios Git públicos, sin conexión con un Git Provider, requieren despliegue manual**. Esto es una posibilidad por investigar, no una causa confirmada del presente servicio.
- Un commit con **cero comprobaciones CI detectadas** o con alguna comprobación fallida no despliega automáticamente bajo `checksPass`.
- Los cambios de los paquetes que modifiquen esquemas SQL deben gestionar sus migraciones antes del despliegue del nuevo backend; no usar el despliegue automático para saltarse ese paso.
- Conservar la versión `Live` de Render mientras se diagnostica; no generar nuevas cuentas ni cambiar contraseñas para este procedimiento.

**Fuentes:**
- Render: https://render.com/docs/deploys
- Conexión Git Provider: https://render.com/docs/git-provider

**Pendiente de cierre:** observar al menos un despliegue originado **automáticamente** después de un merge aprobado por CI.
