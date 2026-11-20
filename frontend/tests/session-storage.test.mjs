import test from 'node:test';
import assert from 'node:assert/strict';
import {
  guardarSesionEnPestana, recuperarSesionDePestana, actualizarUsuarioDeSesion,
  borrarSesionDePestana, guardarPaginaEnPestana, recuperarPaginaDePestana
} from '../src/session.ts';

function storage() {
  const registros = new Map();
  return {
    getItem: (k) => registros.get(k) ?? null,
    setItem: (k, v) => registros.set(k, String(v)),
    removeItem: (k) => registros.delete(k),
    clear: () => registros.clear(),
    _map: registros
  };
}

const sesionDemo = () => ({
  access_token: 'jwt-ficticio-para-pruebas',
  token_type: 'Bearer',
  expires_in_seconds: 900,
  usuario: { id_usuario: '1', nombre_usuario: 'admin.prueba', roles: ['ADMIN_GENERAL'] }
});

test.beforeEach(() => { globalThis.sessionStorage = storage(); });

test('persiste y restaura la sesión después de una recarga simulada', () => {
  const sesion = sesionDemo();
  guardarSesionEnPestana(sesion);
  assert.deepEqual(recuperarSesionDePestana(), sesion);
});

test('una sesión caducada se elimina y no se restaura', () => {
  guardarSesionEnPestana(sesionDemo());
  const guardada = JSON.parse(sessionStorage.getItem('sigpmat.sesion.v1'));
  guardada.venceEn = Date.now() - 1;
  sessionStorage.setItem('sigpmat.sesion.v1', JSON.stringify(guardada));
  assert.equal(recuperarSesionDePestana(), null);
  assert.equal(sessionStorage.getItem('sigpmat.sesion.v1'), null);
});

test('datos de sesión corruptos no reactivan al usuario', () => {
  sessionStorage.setItem('sigpmat.sesion.v1', '{no-es-json');
  assert.equal(recuperarSesionDePestana(), null);
  assert.equal(sessionStorage.getItem('sigpmat.sesion.v1'), null);
});

test('al actualizar roles se mantiene la fecha original de vencimiento', () => {
  guardarSesionEnPestana(sesionDemo());
  const anterior = JSON.parse(sessionStorage.getItem('sigpmat.sesion.v1'));
  actualizarUsuarioDeSesion({ id_usuario: '1', nombre_usuario: 'admin.prueba', roles: ['JEFE_AREA'] });
  const actual = JSON.parse(sessionStorage.getItem('sigpmat.sesion.v1'));
  assert.equal(actual.venceEn, anterior.venceEn);
  assert.deepEqual(actual.sesion.usuario.roles, ['JEFE_AREA']);
});

test('no modifica roles si la identidad difiere', () => {
  guardarSesionEnPestana(sesionDemo());
  actualizarUsuarioDeSesion({ id_usuario: '999', nombre_usuario: 'otra', roles: ['JEFE_AREA'] });
  assert.deepEqual(recuperarSesionDePestana().usuario.roles, ['ADMIN_GENERAL']);
});

test('mantiene la sección y limpia todo al cerrar sesión', () => {
  guardarSesionEnPestana(sesionDemo());
  guardarPaginaEnPestana('turnos');
  assert.equal(recuperarPaginaDePestana(), 'turnos');
  borrarSesionDePestana();
  assert.equal(recuperarPaginaDePestana(), 'resumen');
  assert.equal(recuperarSesionDePestana(), null);
});

test('maneja almacenamiento bloqueado sin fallar la aplicación', () => {
  globalThis.sessionStorage = {
    getItem: () => { throw new Error('Almacenamiento bloqueado'); },
    setItem: () => { throw new Error('Almacenamiento bloqueado'); },
    removeItem: () => { throw new Error('Almacenamiento bloqueado'); }
  };
  assert.doesNotThrow(() => guardarSesionEnPestana(sesionDemo()));
  assert.equal(recuperarSesionDePestana(), null);
  assert.equal(recuperarPaginaDePestana(), 'resumen');
  assert.doesNotThrow(() => borrarSesionDePestana());
});
