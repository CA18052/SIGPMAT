import assert from 'node:assert/strict';
import {test} from 'node:test';
import {diagnosticarErrorAura, mensajeErrorAura} from '../src/aura/diagnostico.js';

test('cuota Free identifica 429, no cambia proveedor',()=>{
  const e=diagnosticarErrorAura(429,{error:{message:'Too many requests',type:'rate_limit_error'}});
  assert.equal(e.causa,'LIMITE');
  assert.equal(e.status,429);
  assert.match(mensajeErrorAura(e.causa,'groq'),/cuota gratuita/);
});
test('herramienta generada inválida se detecta para un único reintento',()=>{
  const e=diagnosticarErrorAura(400,{error:{
    message:'Invalid tool call generated',type:'invalid_request_error',
    failed_generation:{reason:'bad JSON',attempted_arguments:'texto privado'}
  }});
  assert.equal(e.causa,'HERRAMIENTA_INVALIDA');
  assert.equal(e.tipo,'invalid_request_error');
  assert.equal(e.codigo,'no_especificado');
  assert.doesNotMatch(mensajeErrorAura(e.causa,'groq'),/texto privado/);
});
test('error 400 no asociado a herramientas se informa como solicitud inválida',()=>{
  const e=diagnosticarErrorAura(400,{error:{message:'Unsupported field',code:'unsupported_parameter'}});
  assert.equal(e.causa,'SOLICITUD_INVALIDA');
  assert.equal(e.codigo,'unsupported_parameter');
});
test('credenciales y fallas de red no se confunden con límites',()=>{
  assert.equal(diagnosticarErrorAura(401,null).causa,'CREDENCIAL');
  assert.equal(diagnosticarErrorAura(403,null).causa,'CREDENCIAL');
  assert.equal(diagnosticarErrorAura(503,null).causa,'NO_DISPONIBLE');
});
test('campos potencialmente sensibles nunca se admiten como códigos de log',()=>{
  const e=diagnosticarErrorAura(400,{error:{type:'User ID 1234',code:'key=gsk_secret'}});
  assert.equal(e.tipo,'no_especificado');
  assert.equal(e.codigo,'no_especificado');
});
