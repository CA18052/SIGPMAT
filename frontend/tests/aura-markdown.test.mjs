import assert from 'node:assert/strict';
import {test} from 'node:test';
import {analizarMarkdownAura} from '../src/auraMarkdown.ts';

test('AURA convierte la tabla Markdown de departamentos en filas separadas',()=>{
  const texto='Los departamentos son:\n\n| ID | Nombre |\n|---|---|\n| 4 | Cirugía General |\n| 11 | Cardiología |';
  const bloques=analizarMarkdownAura(texto);
  assert.equal(bloques[0].tipo,'parrafo');
  assert.equal(bloques[1].tipo,'tabla');
  assert.deepEqual(bloques[1].encabezados,['ID','Nombre']);
  assert.deepEqual(bloques[1].filas,[['4','Cirugía General'],['11','Cardiología']]);
});
test('AURA distingue listas, encabezados y citas explicativas',()=>{
  const texto='## Candidatos\n\n1. Paula\n2. Isabel\n\n> Sin conflictos no garantiza disponibilidad.';
  const bloques=analizarMarkdownAura(texto);
  assert.deepEqual(bloques.map(b=>b.tipo),['titulo','lista','cita']);
  assert.equal(bloques[1].ordenada,true);
  assert.deepEqual(bloques[1].elementos,['Paula','Isabel']);
});
test('AURA interpreta saltos y tablas con columnas faltantes sin desbordarse',()=>{
  const texto='| Empleado | Cargo | Estado |\r\n|---|---|---|\r\n| Paula | Médico |';
  const bloques=analizarMarkdownAura(texto);
  assert.equal(bloques[0].tipo,'tabla');
  assert.deepEqual(bloques[0].filas,[['Paula','Médico','']]);
});
test('Texto no confiable permanece texto: no se crea HTML o scripts',()=>{
  const malicioso='Prueba <img src=x onerror=alert(1)> y <script>alert(2)</script>';
  const bloques=analizarMarkdownAura(malicioso);
  assert.equal(bloques[0].tipo,'parrafo');
  assert.equal(bloques[0].texto,malicioso);
  assert.equal(JSON.stringify(bloques).includes('<script>'),true);
  // El componente AuraTexto usa JSX para presentar estas cadenas; no HTML innerHTML.
});
test('Tablas grandes y párrafos comunes no se confunden',()=>{
  const texto='El cargo Médico | especialista sigue vigente.\n\n| Columna A | B |\n|---|---|\n| 1 | 2 |';
  const bloques=analizarMarkdownAura(texto);
  assert.deepEqual(bloques.map(b=>b.tipo),['parrafo','tabla']);
});
test('Bloques de código cercados se mantienen como texto literal',()=>{
  const fence=String.fromCharCode(96).repeat(3);
  const texto=fence+'sql\nSELECT * FROM foo;\n'+fence;
  const bloques=analizarMarkdownAura(texto);
  assert.equal(bloques[0].tipo,'codigo');
  assert.equal(bloques[0].texto,'SELECT * FROM foo;');
});
