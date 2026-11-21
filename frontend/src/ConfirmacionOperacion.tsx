import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SolicitudConfirmacion } from './api';

export default function ConfirmacionOperacion({
  solicitud,confirmar,cancelar
}:{
  solicitud:SolicitudConfirmacion;confirmar:(clave:string)=>void;cancelar:()=>void
}){
  const [clave,setClave]=useState('');
  const accion=solicitud.metodo==='DELETE'?'eliminar':
    solicitud.metodo==='POST'?'crear o registrar':'modificar';
  return <div className="overlay reauth-overlay" role="presentation">
    <section className="reauth-dialog" role="dialog" aria-modal="true"
      aria-labelledby="reauth-titulo" aria-describedby="reauth-ayuda">
      <div className="reauth-symbol" aria-hidden="true">✚</div>
      <div className="eyebrow">CONFIRMACIÓN DE SEGURIDAD</div>
      <h2 id="reauth-titulo">Confirma tu identidad</h2>
      <p id="reauth-ayuda">Para {accion} información, vuelve a introducir tu contraseña.
        El sistema verificará tu identidad antes de guardar cualquier cambio.</p>
      <form onSubmit={(e:FormEvent<HTMLFormElement>)=>{
        e.preventDefault();if(!clave)return;confirmar(clave);setClave('');
      }}>
        <label>Contraseña actual
          <input type="password" autoFocus required value={clave} autoComplete="current-password"
            onChange={e=>setClave(e.target.value)} maxLength={128}/>
        </label>
        <div className="reauth-actions">
          <button type="button" className="button ghost" onClick={cancelar}>Cancelar</button>
          <button type="submit" className="button primary">Confirmar operación</button>
        </div>
      </form>
      <small>Esta confirmación solo autoriza la operación actual. No activa permisos adicionales.</small>
    </section>
  </div>;
}
