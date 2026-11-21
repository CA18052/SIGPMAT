import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seleccionarProveedorAura, cargaProveedorAura } from '../src/aura/proveedor.js';

test('Groq es predeterminado y jamás cae en OpenAI facturable',()=>{
  const soloOpenAI={OPENAI_API_KEY:'clave-openai'};
  assert.equal(seleccionarProveedorAura(soloOpenAI),null);
  const r=seleccionarProveedorAura({GROQ_API_KEY:'groq-de-prueba',
    OPENAI_API_KEY:'clave-openai'});
  assert.equal(r?.tipo,'groq');
  assert.equal(r?.modelo,'openai/gpt-oss-20b');
  assert.equal(r?.endpoint,'https://api.groq.com/openai/v1/responses');
});
test('OpenAI se utiliza únicamente si el usuario lo pide expresamente',()=>{
  const r=seleccionarProveedorAura({AURA_PROVEEDOR:'openai',
    OPENAI_API_KEY:'clave-openai'});
  assert.equal(r?.tipo,'openai');
  assert.equal(r?.modelo,'gpt-4.1-mini');
  assert.equal(seleccionarProveedorAura({AURA_PROVEEDOR:'openai',
    GROQ_API_KEY:'groq'}),null);
});
test('No se aceptan nombres de proveedores no reconocidos',()=>{
  assert.equal(seleccionarProveedorAura({AURA_PROVEEDOR:'otro',
    GROQ_API_KEY:'groq',OPENAI_API_KEY:'openai'}),null);
});
test('Groq no envía store, que no está admitido en su API Responses',()=>{
  const proveedor=seleccionarProveedorAura({GROQ_API_KEY:'clave'})!;
  const payload=cargaProveedorAura({model:proveedor.modelo,store:false,
    input:[{role:'user',content:'hola'}]},proveedor);
  assert.equal(Object.hasOwn(payload,'store'),false);
  assert.equal(payload.model,'openai/gpt-oss-20b');
});
test('OpenAI mantiene store false para no guardar respuestas',()=>{
  const proveedor=seleccionarProveedorAura({AURA_PROVEEDOR:'openai',
    OPENAI_API_KEY:'clave'})!;
  const payload=cargaProveedorAura({model:proveedor.modelo},proveedor);
  assert.equal(payload.store,false);
});