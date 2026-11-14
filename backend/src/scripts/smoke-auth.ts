import { input, password } from '@inquirer/prompts';

const usuario = await input({ message: 'Nombre de usuario:', default: 'admin.dev' });
const contrasena = await password({ message: 'Contraseña (oculta):', mask: '*' });
const base = 'http://127.0.0.1:3001';

function reportar(caso: string, obtenido: number, esperado: number): void {
  const estado = obtenido === esperado ? 'OK' : 'FALLO';
  console.log(`${estado}: ${caso} — HTTP ${obtenido} (esperado ${esperado})`);
  if (obtenido !== esperado) process.exitCode = 1;
}

const sinToken = await fetch(`${base}/api/auth/me`);
reportar('ruta protegida sin token', sinToken.status, 401);

const incorrecta = await fetch(`${base}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nombre_usuario: usuario, contrasena: contrasena + '-incorrecta' })
});
reportar('contraseña incorrecta', incorrecta.status, 401);

const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nombre_usuario: usuario, contrasena })
});
reportar('acceso con credenciales validas', login.status, 200);
if (!login.ok) process.exit(1);
const datos = await login.json() as { access_token?: string };
if (!datos.access_token) throw new Error('La respuesta no contiene access_token');
const headers = { Authorization: `Bearer ${datos.access_token}` };

const me = await fetch(`${base}/api/auth/me`, { headers });
reportar('identidad con token', me.status, 200);

const admin = await fetch(`${base}/api/admin/ping`, { headers });
reportar('acceso ADMIN_GENERAL', admin.status, 200);

console.log('Prueba finalizada. El token no se imprime en pantalla.');
