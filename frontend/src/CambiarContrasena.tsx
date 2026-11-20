import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, requestApi } from './api';

export default function CambiarContrasena({
  token, obligatorio, onCompletado, onCerrar, onSesionExpirada
}: {
  token:string; obligatorio:boolean; onCompletado:()=>void;
  onCerrar:()=>void; onSesionExpirada:()=>void;
}) {
  const [actual,setActual]=useState('');
  const [nueva,setNueva]=useState('');
  const [repetir,setRepetir]=useState('');
  const [procesando,setProcesando]=useState(false);
  const [error,setError]=useState('');

  async function guardar(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();if(procesando)return;
    setError('');
    if(nueva!==repetir){setError('Las contraseñas nuevas no coinciden.');return;}
    if(nueva===actual){setError('La nueva contraseña debe ser diferente de la anterior.');return;}
    setProcesando(true);
    try {
      await requestApi('/api/auth/cambiar-contrasena',token,{
        method:'POST',
        body:JSON.stringify({contrasena_actual:actual,nueva_contrasena:nueva})
      });
      setActual('');setNueva('');setRepetir('');
      onCompletado();
    }catch(e){
      if(e instanceof ApiError && e.status===401 && !e.message.includes('contraseña actual')){
        onSesionExpirada();
      }else setError(e instanceof Error?e.message:'No se pudo actualizar la contraseña.');
    }finally{setProcesando(false);}
  }

  const formulario=<section className="password-change-panel" role={obligatorio?undefined:'dialog'}
    aria-modal={obligatorio?undefined:true} aria-labelledby="cambio-clave-titulo">
    <div className="password-change-icon" aria-hidden="true">✚</div>
    <span className="eyebrow">SEGURIDAD DE ACCESO</span>
    <h1 id="cambio-clave-titulo">
      {obligatorio?'Cambia tu contraseña temporal':'Cambiar mi contraseña'}
    </h1>
    <p className="muted">
      {obligatorio
        ? 'Para continuar debes sustituir la contraseña provisional. Después iniciarás sesión con la nueva.'
        : 'Al cambiar tu contraseña, se cerrarán las sesiones anteriores y tendrás que iniciar sesión de nuevo.'}
    </p>
    <form className="employee-form" onSubmit={guardar}>
      <label>Contraseña actual
        <input type="password" required autoFocus maxLength={128} autoComplete="current-password"
          value={actual} onChange={e=>setActual(e.target.value)}/>
      </label>
      <label>Nueva contraseña
        <input type="password" required minLength={12} maxLength={128} autoComplete="new-password"
          value={nueva} onChange={e=>setNueva(e.target.value)}/>
        <small>Utiliza al menos 12 caracteres; lo ideal es una frase larga y única.</small>
      </label>
      <label>Confirmar nueva contraseña
        <input type="password" required minLength={12} maxLength={128} autoComplete="new-password"
          value={repetir} onChange={e=>setRepetir(e.target.value)}/>
      </label>
      {error&&<div role="alert" className="alert">{error}</div>}
      <button type="submit" className="button primary full" disabled={procesando}>
        {procesando?'Cambiando contraseña…':'Guardar contraseña'}
      </button>
      <button type="button" className="button ghost full" disabled={procesando} onClick={onCerrar}>
        {obligatorio?'Cerrar sesión':'Cancelar'}
      </button>
    </form>
  </section>;

  return obligatorio
    ? <div className="password-change-screen">{formulario}</div>
    : <div className="overlay password-change-overlay" role="presentation"
        onMouseDown={e=>{if(e.target===e.currentTarget&&!procesando)onCerrar();}}>
        {formulario}
      </div>;
}
