import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, requestApi } from './api';
import type { Departamento } from './api';

type Campos = { codigo:string; nombre:string; ubicacion:string; extension:string };

export default function FormularioDepartamento({
  token, departamento, onCerrar, onGuardado, onSesionExpirada
}: {
  token:string; departamento:Departamento | null;
  onCerrar:()=>void; onGuardado:()=>void; onSesionExpirada:()=>void;
}) {
  const [datos,setDatos]=useState<Campos>({
    codigo:departamento?.codigo||'',nombre:departamento?.nombre||'',
    ubicacion:departamento?.ubicacion||'',extension:departamento?.extension||''
  });
  const [guardando,setGuardando]=useState(false);
  const [error,setError]=useState('');
  const editar=Boolean(departamento);

  async function guardar(evento:FormEvent<HTMLFormElement>){
    evento.preventDefault();if(guardando)return;
    setError('');setGuardando(true);
    try{
      const payload={
        codigo:datos.codigo.trim().toUpperCase(),
        nombre:datos.nombre.trim(),
        ubicacion:datos.ubicacion.trim()||null,
        extension:datos.extension.trim()||null
      };
      await requestApi(editar?'/api/departamentos/'+departamento!.id_departamento:'/api/departamentos',
        token,{method:editar?'PATCH':'POST',body:JSON.stringify(payload)});
      onGuardado();
    }catch(e){
      if(e instanceof ApiError && e.status===401)onSesionExpirada();
      else setError(e instanceof Error?e.message:'No se pudo guardar el departamento');
    }finally{setGuardando(false);}
  }

  return <div className="overlay" role="presentation" onMouseDown={e=>{
      if(e.target===e.currentTarget&&!guardando)onCerrar();
    }}>
    <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="dept-form-titulo">
      <div className="drawer-header">
        <span className="eyebrow">GESTIÓN HOSPITALARIA</span>
        <button type="button" className="icon-btn" aria-label="Cerrar" disabled={guardando}
          onClick={onCerrar}>✕</button>
      </div>
      <h2 id="dept-form-titulo">{editar?'Editar departamento':'Registrar departamento'}</h2>
      <p className="muted employee-form-intro">
        Define el área hospitalaria y su ubicación. Solo la administración puede gestionar departamentos.
      </p>
      {error&&<div role="alert" className="alert">! {error}</div>}
      <form className="employee-form" onSubmit={guardar}>
        <label>Código institucional
          <input autoFocus required minLength={3} maxLength={20} pattern="[A-Za-z0-9-]+"
            value={datos.codigo} placeholder="HOSP-NEU" onChange={e=>setDatos(v=>({...v,codigo:e.target.value}))}/>
        </label>
        <label>Nombre del departamento
          <input required minLength={2} maxLength={80} value={datos.nombre}
            placeholder="Neurología" onChange={e=>setDatos(v=>({...v,nombre:e.target.value}))}/>
        </label>
        <label>Ubicación física (opcional)
          <input maxLength={120} value={datos.ubicacion} placeholder="Torre B · nivel 3"
            onChange={e=>setDatos(v=>({...v,ubicacion:e.target.value}))}/>
        </label>
        <label>Extensión telefónica (opcional)
          <input maxLength={20} value={datos.extension} placeholder="240"
            onChange={e=>setDatos(v=>({...v,extension:e.target.value}))}/>
        </label>
        <div className="employee-form-actions">
          <button type="button" className="button ghost" disabled={guardando} onClick={onCerrar}>Cancelar</button>
          <button className="button primary" type="submit" disabled={guardando}>
            {guardando?'Guardando…':editar?'Guardar cambios':'Registrar departamento'}
          </button>
        </div>
      </form>
    </section>
  </div>;
}
