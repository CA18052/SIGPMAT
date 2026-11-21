import { useState } from 'react';
import type { FormEvent } from 'react';
import { registrarVisitante } from './api';

export default function RegistroPublico({
  onVolver,onCreada
}:{onVolver:()=>void;onCreada:(carnet:string)=>void}){
  const [carnet,setCarnet]=useState('');
  const [nombre,setNombre]=useState('');
  const [contrasena,setContrasena]=useState('');
  const [confirmar,setConfirmar]=useState('');
  const [error,setError]=useState('');
  const [procesando,setProcesando]=useState(false);

  async function registrar(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(procesando)return;
    setError('');
    if(!/^[A-Z]{2}[0-9]{5}$/.test(carnet)){
      setError('Introduce exactamente dos letras mayúsculas seguidas de cinco números.');
      return;
    }
    if(contrasena!==confirmar){setError('Las contraseñas no coinciden.');return;}
    if(contrasena.length<12){setError('La contraseña debe contener al menos 12 caracteres.');return;}
    setProcesando(true);
    try{
      await registrarVisitante(carnet,contrasena,nombre.trim()||undefined);
      setContrasena('');setConfirmar('');
      onCreada(carnet);
    }catch(e){setError(e instanceof Error?e.message:'No fue posible registrar la cuenta.');}
    finally{setProcesando(false);}
  }

  return <div className="public-signup">
    <div className="eyebrow">CREAR CUENTA · LECTURA</div>
    <h2>Explora SIGPMAT</h2>
    <p className="muted intro">Regístrate con tu carnet universitario para consultar personal, departamentos y turnos. Esta cuenta <strong>no permite modificar información</strong>.</p>
    <form onSubmit={registrar} className="login-form">
      <label className="field">Carnet universitario
        <input required autoCapitalize="characters" autoComplete="username"
          value={carnet} maxLength={7} minLength={7} pattern="[A-Z]{2}[0-9]{5}"
          placeholder="AB12345" onChange={e=>setCarnet(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}/>
        <span className="signup-hint">Dos iniciales de tus apellidos y cinco números. Ejemplo ficticio: AB12345.</span>
      </label>
      <label className="field">Nombre para mostrar (opcional)
        <input value={nombre} maxLength={120} placeholder="Tu nombre"
          autoComplete="name" onChange={e=>setNombre(e.target.value)}/>
      </label>
      <label className="field">Contraseña
        <input required type="password" autoComplete="new-password" minLength={12}
          maxLength={128} value={contrasena} placeholder="12 caracteres como mínimo"
          onChange={e=>setContrasena(e.target.value)}/>
      </label>
      <label className="field">Repetir contraseña
        <input required type="password" autoComplete="new-password"
          value={confirmar} onChange={e=>setConfirmar(e.target.value)}/>
      </label>
      {error&&<div className="alert" role="alert">{error}</div>}
      <button type="submit" className="button primary full" disabled={procesando}>
        {procesando?'Creando acceso…':'Crear cuenta de lectura'}
      </button>
    </form>
    <button type="button" className="button ghost full" onClick={onVolver}>Volver a iniciar sesión</button>
    <p className="signup-hint">El carnet se utiliza como nombre de usuario, pero su formato por sí solo no certifica la identidad de su titular. Para funciones administrativas, solicita una cuenta al superadministrador.</p>
  </div>;
}
