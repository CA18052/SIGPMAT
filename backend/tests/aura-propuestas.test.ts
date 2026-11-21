import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.JWT_SECRET = 'f'.repeat(96);
const { crearPropuesta, verificarPropuesta } = await import('../src/aura/propuestas.js');

test('ticket válido se vincula a usuario y acción',()=>{
  const p=crearPropuesta('1','crear_turno','/api/turnos',{
    id_departamento:'1',id_cargo:'1',tipo_turno:'diurno',cupos_requeridos:2
  },'Nuevo turno');
  assert.equal(p.tipo,'crear_turno');
  const v=verificarPropuesta(p.ticket,'1');
  assert.equal(v?.tipo,'crear_turno');
  assert.equal(v?.ruta,'/api/turnos');
  assert.equal(v?.usuario,'1');
  assert.equal(v?.datos.cupos_requeridos,2);
  assert.equal(verificarPropuesta(p.ticket,'2'),null);
});

test('ticket falsificado y rutas no autorizadas se rechazan',()=>{
  const p=crearPropuesta('1','crear_empleado','/api/empleados',{
    codigo_empleado:'DEMO-TEMP-01'
  },'Alta');
  assert.ok(verificarPropuesta(p.ticket,'1'));
  assert.equal(verificarPropuesta(p.ticket.slice(0,-3)+'AAA','1'),null);
  const inadecuado=crearPropuesta('1','crear_empleado','/api/admin/usuarios',{},'Autousuario');
  assert.equal(verificarPropuesta(inadecuado.ticket,'1'),null);
});

test('asignación solo puede apuntar al endpoint permitido',()=>{
  const permitido=crearPropuesta('8','asignar_empleado','/api/turnos/12/asignaciones',{
    id_requerimiento:'15',id_empleado:'6'
  },'Asignar');
  assert.ok(verificarPropuesta(permitido.ticket,'8'));
  const inadecuado=crearPropuesta('8','asignar_empleado','/api/turnos/12/cancelar',{},'Cancelar');
  assert.equal(verificarPropuesta(inadecuado.ticket,'8'),null);
});

test('tickets expirados, texto malformado y objetos inesperados se rechazan',()=>{
  assert.equal(verificarPropuesta('basura','1'),null);
  assert.equal(verificarPropuesta('x'.repeat(3700),'1'),null);
  const p=crearPropuesta('1','crear_turno','/api/turnos',{},'Turno');
  const partes=p.ticket.split('.');
  assert.equal(partes.length,2);
  assert.equal(verificarPropuesta(partes[0]+'.'+partes[1].slice(0,-1)+'x','1'),null);
});
