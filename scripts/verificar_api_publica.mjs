#!/usr/bin/env node
/**
 * SIGPMAT — pruebas HTTP públicas y NO DESTRUCTIVAS de predefensa.
 *
 * Sólo realiza GET. No inicia sesión, no modifica empleados, no elimina datos
 * y no necesita credenciales ni acceso a Neon.
 *
 * Uso:
 *   node scripts/verificar_api_publica.mjs
 *   SIGPMAT_BASE_URL=http://localhost:3000 node scripts/verificar_api_publica.mjs
 */
import assert from 'node:assert/strict';

const base = new URL(process.env.SIGPMAT_BASE_URL || 'https://sigpmat-demo.onrender.com');
if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) {
  throw new Error('Por seguridad, sólo se aceptan URLs HTTPS o localhost.');
}

let correctas = 0;
const resultados = [];

const pausa = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function consultar(ruta, intentos = 1) {
  let ultimoError;
  for (let i = 0; i < intentos; i += 1) {
    try {
      const url = new URL(ruta, base);
      const respuesta = await fetch(url, {
        method: 'GET',
        headers: { Accept: ruta.startsWith('/api/') ? 'application/json' : '*/*' },
        signal: AbortSignal.timeout(110000),
        redirect: 'error'
      });
      return { respuesta, contenido: await respuesta.text() };
    } catch (error) {
      ultimoError = error;
      if (i + 1 < intentos) {
        console.log('Render puede estar despertando; nuevo intento de lectura…');
        await pausa(4000);
      }
    }
  }
  throw ultimoError;
}

async function comprobar(nombre, ruta, codigo, verificar, intentos = 1) {
  try {
    const { respuesta, contenido } = await consultar(ruta, intentos);
    assert.equal(respuesta.status, codigo, `Código HTTP inesperado para ${ruta}`);
    if (verificar) verificar(respuesta, contenido);
    correctas++;
    resultados.push({ nombre, estado: 'APROBADA', codigo: respuesta.status });
    console.log(`✓ ${nombre} — HTTP ${respuesta.status}`);
  } catch (error) {
    resultados.push({ nombre, estado: 'FALLIDA', error: String(error) });
    console.error(`✗ ${nombre} — ${error instanceof Error ? error.message : String(error)}`);
  }
}

function respuestaJson(respuesta, contenido) {
  assert.match(respuesta.headers.get('content-type') || '', /application\/json/i);
  return JSON.parse(contenido);
}

function protegida(respuesta, contenido) {
  const json = respuestaJson(respuesta, contenido);
  assert.equal(typeof json.error, 'string');
  assert.match(respuesta.headers.get('cache-control') || '', /no-store/i);
}

console.log(`SIGPMAT: verificación pública de solo lectura → ${base.origin}`);

await comprobar('API disponible', '/api/health', 200, (res, body) => {
  const j = respuestaJson(res, body);
  assert.equal(j.status, 'ok');
  assert.equal(j.service, 'SIGPMAT API');
}, 3);

await comprobar('Frontend publicado', '/', 200, (res, body) => {
  assert.match(res.headers.get('content-type') || '', /text\/html/i);
  assert.match(body, /<html/i);
  assert.match(body, /SIGPMAT/i);
  assert.match(res.headers.get('x-content-type-options') || '', /nosniff/i);
});

await comprobar('Retratos reales de demostración', '/retratos/equipo-realista.jpg', 200, (res) => {
  assert.match(res.headers.get('content-type') || '', /image\/jpeg/i);
});

const rutasProtegidas = [
  ['/api/auth/me', 'Acceso a cuenta sin sesión'],
  ['/api/admin/ping', 'Acceso administrativo sin sesión'],
  ['/api/health/db', 'Información de base de datos protegida'],
  ['/api/departamentos', 'Directorio de departamentos protegido'],
  ['/api/empleados', 'Directorio de empleados protegido'],
  ['/api/turnos', 'Directorio de turnos protegido'],
  ['/api/empleados/1', 'Detalle de empleado protegido'],
  ['/api/turnos/1', 'Detalle de turno protegido']
];

for (const [ruta, nombre] of rutasProtegidas) {
  await comprobar(nombre, ruta, 401, protegida);
}

await comprobar('API inexistente no entrega React', '/api/ruta-inexistente-sigpmat', 404, (res, body) => {
  const j = respuestaJson(res, body);
  assert.equal(typeof j.error, 'string');
});

console.log(`\nResultado: ${correctas}/${resultados.length} comprobaciones aprobadas.`);
if (correctas !== resultados.length) process.exitCode = 1;
