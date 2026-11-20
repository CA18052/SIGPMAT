import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, requestApi } from './api';

type Tipo = 'integrante' | 'docente';
type Cuenta = {
  id_usuario: string;
  nombre_usuario: string;
  nombre_mostrado: string | null;
  tipo_cuenta: string;
  estado: string;
  es_superadministrador: boolean;
  debe_cambiar_contrasena: boolean;
  ultimo_acceso_at: string | null;
  creado_at: string;
  roles: string[];
};
type Creada = { usuario: Cuenta; contrasena_temporal?: string; aviso: string };
const tipoLabel = (tipo:string) => tipo==='integrante'?'Integrante del equipo':
  tipo==='docente'?'Docente evaluador':'Cuenta de demostración';

export default function Usuarios({
  token, onSesionExpirada
}: {token:string;onSesionExpirada:()=>void}) {
  const [usuarios,setUsuarios]=useState<Cuenta[]>([]);
  const [cargando,setCargando]=useState(true);
  const [procesando,setProcesando]=useState('');
  const [error,setError]=useState('');
  const [exito,setExito]=useState('');
  const [crear,setCrear]=useState(false);
  const [usuario,setUsuario]=useState('');
  const [nombre,setNombre]=useState('');
  const [tipo,setTipo]=useState<Tipo>('integrante');
  const [correo,setCorreo]=useState('');
  const [contrasena,setContrasena]=useState('');
  const [generar,setGenerar]=useState(true);
  const [claveVisible,setClaveVisible]=useState<{usuario:string;clave:string}|null>(null);
  const [mostrarMiIdentidad,setMostrarMiIdentidad]=useState(false);
  const [miCarnet,setMiCarnet]=useState('');
  const [miNombre,setMiNombre]=useState('');
  const [miContrasena,setMiContrasena]=useState('');

  const manejarError=useCallback((e:unknown)=>{
    if(e instanceof ApiError && e.status===401){onSesionExpirada();return;}
    setError(e instanceof Error?e.message:'No se pudo completar la operación.');
  },[onSesionExpirada]);

  const cargar=useCallback(async()=>{
    const datos=await requestApi<{usuarios:Cuenta[]}>('/api/admin/usuarios',token);
    setUsuarios(datos.usuarios);
  },[token]);

  useEffect(()=>{
    let activo=true;
    requestApi<{usuarios:Cuenta[]}>('/api/admin/usuarios',token)
      .then(r=>{if(activo)setUsuarios(r.usuarios);})
      .catch(e=>{if(activo)manejarError(e);})
      .finally(()=>{if(activo)setCargando(false);});
    return ()=>{activo=false;};
  },[token,manejarError]);

  function limpiarFormulario(){
    setCrear(false);setUsuario('');setNombre('');setTipo('integrante');
    setCorreo('');setContrasena('');setGenerar(true);
  }

  async function guardar(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(procesando)return;
    setError('');setExito('');setClaveVisible(null);setProcesando('crear');
    try{
      const payload={
        nombre_usuario:usuario.trim(),nombre_mostrado:nombre.trim(),
        tipo_cuenta:tipo,
        ...(correo.trim()?{correo_institucional:correo.trim()}:{}),
        ...(!generar?{contrasena}:{})
      };
      const r=await requestApi<Creada>('/api/admin/usuarios',token,{
        method:'POST',body:JSON.stringify(payload)
      });
      limpiarFormulario();
      if(r.contrasena_temporal)
        setClaveVisible({usuario:r.usuario.nombre_usuario,clave:r.contrasena_temporal});
      setExito('Cuenta de '+r.usuario.nombre_usuario+' creada. La clave deberá cambiarse en el primer ingreso.');
      await cargar();
    }catch(e){manejarError(e);}
    finally{setProcesando('');}
  }

  async function actualizarMiIdentidad(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(procesando)return;
    setProcesando('identidad');setError('');setExito('');
    try{
      await requestApi('/api/admin/usuarios/mi-identidad',token,{
        method:'PATCH',
        body:JSON.stringify({
          nuevo_usuario:miCarnet.trim(),
          nombre_mostrado:miNombre.trim(),
          contrasena_actual:miContrasena
        })
      });
      setMiContrasena('');
      // Cambiar el carnet revoca el JWT: iniciar sesión usando el nuevo carnet.
      onSesionExpirada();
    }catch(e){manejarError(e);}
    finally{setProcesando('');}
  }

  async function cambiarEstado(u:Cuenta){
    if(procesando||u.es_superadministrador)return;
    const nuevo=u.estado==='activa'?'bloqueada':'activa';
    if(!window.confirm((nuevo==='bloqueada'?'¿Bloquear':'¿Habilitar')+
      ' la cuenta '+u.nombre_usuario+'? Los accesos anteriores quedarán revocados.'))return;
    setError('');setExito('');setClaveVisible(null);setProcesando(u.id_usuario);
    try{
      await requestApi('/api/admin/usuarios/'+u.id_usuario+'/estado',token,{
        method:'PATCH',body:JSON.stringify({estado:nuevo})
      });
      setExito('Estado actualizado para '+u.nombre_usuario+'.');
      await cargar();
    }catch(e){manejarError(e);}
    finally{setProcesando('');}
  }

  async function restablecer(u:Cuenta){
    if(procesando||u.es_superadministrador)return;
    if(!window.confirm('¿Generar una nueva contraseña temporal para '+u.nombre_usuario+
      '? La contraseña anterior dejará de funcionar de inmediato.'))return;
    setError('');setExito('');setClaveVisible(null);setProcesando(u.id_usuario);
    try{
      const r=await requestApi<{contrasena_temporal:string}>(
        '/api/admin/usuarios/'+u.id_usuario+'/restablecer',token,{
          method:'POST',body:JSON.stringify({})
        });
      setClaveVisible({usuario:u.nombre_usuario,clave:r.contrasena_temporal});
      setExito('Contraseña temporal generada para '+u.nombre_usuario+'.');
      await cargar();
    }catch(e){manejarError(e);}
    finally{setProcesando('');}
  }

  return <section className="users-console">
    <div className="panel user-management-panel">
      <div className="panel-heading wrap-heading">
        <div>
          <div className="eyebrow">CONTROL DE ACCESO</div>
          <h2>Administración de usuarios</h2>
          <p>Acceso reservado al superadministrador. Cada persona utiliza sus propias credenciales.</p>
        </div>
        <div className="user-admin-actions">
          <button type="button" className="button ghost"
            onClick={()=>{
              const propia=usuarios.find(u=>u.es_superadministrador);
              setMiCarnet(propia?.nombre_usuario==='admin.demo'?'':propia?.nombre_usuario||'');
              setMiNombre(propia?.nombre_mostrado||'');
              setMostrarMiIdentidad(v=>!v);setCrear(false);setError('');setClaveVisible(null);
            }}>
            {mostrarMiIdentidad?'Cerrar mi identidad':'Usar mi carnet como usuario'}
          </button>
          <button type="button" className="button primary" onClick={()=>{
            setCrear(v=>!v);setMostrarMiIdentidad(false);setError('');setClaveVisible(null);
          }}>{crear?'Cancelar alta':'+ Crear usuario'}</button>
        </div>
      </div>
      {error&&<div role="alert" className="alert">{error}</div>}
      {exito&&<div role="status" className="employee-success">{exito}</div>}

      {claveVisible&&<div className="credentials-once" role="status">
        <div>
          <strong>Guarda esta contraseña temporal</strong>
          <p>Se muestra una sola vez. Entrégala de forma privada y solicita que la cambien al iniciar sesión.</p>
        </div>
        <div className="credentials-data"><span>{claveVisible.usuario}</span>
          <code>{claveVisible.clave}</code></div>
        <button type="button" className="button secondary" onClick={()=>{
          const datos='Usuario: '+claveVisible.usuario+'\nContraseña temporal: '+claveVisible.clave;
          void navigator.clipboard?.writeText(datos).catch(()=>setError('No se pudo copiar; selecciona la clave manualmente.'));
        }}>Copiar credenciales</button>
        <button type="button" className="text-button" onClick={()=>setClaveVisible(null)}>Ocultar contraseña</button>
      </div>}

      {mostrarMiIdentidad&&<form className="user-create-form" onSubmit={actualizarMiIdentidad}>
        <div className="user-form-heading">
          <strong>Configurar mi cuenta como integrante del equipo</strong>
          <p>Podrás utilizar tu carnet para iniciar sesión y conservarás el privilegio exclusivo de superadministrador. Por seguridad, debes confirmar tu contraseña actual. Después tendrás que entrar con el nuevo usuario.</p>
        </div>
        <label>Mi carnet universitario
          <input required minLength={6} maxLength={20} pattern="[A-Za-z]{2,4}[0-9]{4,8}"
            value={miCarnet} placeholder="AB12345" autoComplete="off"
            onChange={e=>setMiCarnet(e.target.value)} disabled={!!procesando}/>
        </label>
        <label>Mi nombre
          <input required minLength={3} maxLength={120} value={miNombre}
            placeholder="Nombre completo" autoComplete="off"
            onChange={e=>setMiNombre(e.target.value)} disabled={!!procesando}/>
        </label>
        <label>Confirmar contraseña actual
          <input type="password" required maxLength={128} value={miContrasena}
            autoComplete="current-password"
            onChange={e=>setMiContrasena(e.target.value)} disabled={!!procesando}/>
        </label>
        <div className="employee-form-actions">
          <button type="button" className="button ghost" disabled={!!procesando}
            onClick={()=>setMostrarMiIdentidad(false)}>Cancelar</button>
          <button type="submit" className="button primary" disabled={!!procesando}>
            {procesando==='identidad'?'Actualizando…':'Confirmar cambio de usuario'}
          </button>
        </div>
      </form>}

      {crear&&<form className="user-create-form" onSubmit={guardar}>
        <div className="user-form-heading">
          <strong>Crear una identidad independiente</strong>
          <p>Los integrantes y el docente podrán administrar los módulos hospitalarios, pero no gestionar cuentas ni consultar la auditoría general.</p>
        </div>
        <label>Tipo de cuenta
          <select value={tipo} onChange={e=>{setTipo(e.target.value as Tipo);setUsuario('');}} disabled={!!procesando}>
            <option value="integrante">Integrante del equipo</option>
            <option value="docente">Docente evaluador</option>
          </select>
        </label>
        <label>{tipo==='integrante'?'Carnet universitario (usuario)':'Nombre de usuario del docente'}
          <input required minLength={3} maxLength={50} value={usuario}
            autoComplete="off" placeholder={tipo==='integrante'?'AB12345':'docente.evaluador'}
            onChange={e=>setUsuario(e.target.value)} disabled={!!procesando}/>
        </label>
        <label>Nombre para mostrar
          <input required minLength={3} maxLength={120} value={nombre}
            placeholder="Nombre completo" autoComplete="off"
            onChange={e=>setNombre(e.target.value)} disabled={!!procesando}/>
        </label>
        <label>Correo institucional (opcional)
          <input type="email" maxLength={150} value={correo}
            placeholder="Se puede dejar vacío" autoComplete="off"
            onChange={e=>setCorreo(e.target.value)} disabled={!!procesando}/>
          <small>Si no se indica correo, se creará un identificador interno sin envío de mensajes.</small>
        </label>
        <label className="user-checkline">
          <input type="checkbox" checked={generar}
            onChange={e=>setGenerar(e.target.checked)} disabled={!!procesando}/>
          <span>Generar contraseña segura automáticamente</span>
        </label>
        {!generar&&<label>Contraseña temporal personalizada
          <input type="password" value={contrasena} minLength={12} maxLength={128} required
            autoComplete="new-password" placeholder="12 caracteres como mínimo"
            onChange={e=>setContrasena(e.target.value)} disabled={!!procesando}/>
        </label>}
        <p className="user-form-warning">Todas las cuentas nuevas deben cambiar su clave en el primer ingreso. No incluyas contraseñas en el PDF público de la universidad.</p>
        <div className="employee-form-actions">
          <button type="button" className="button ghost" onClick={limpiarFormulario} disabled={!!procesando}>Cancelar</button>
          <button type="submit" className="button primary" disabled={!!procesando}>
            {procesando==='crear'?'Creando…':'Crear cuenta'}
          </button>
        </div>
      </form>}

      <div className="user-list">
        {cargando&&<p className="muted">Cargando cuentas…</p>}
        {!cargando&&usuarios.length===0&&<p className="muted">No se encontraron cuentas.</p>}
        {usuarios.map(u=><article className="user-item" key={u.id_usuario}>
          <div className="user-item-icon" aria-hidden="true">{u.nombre_usuario.slice(0,2)}</div>
          <div className="user-item-body">
            <div className="user-item-title"><strong>{u.nombre_mostrado||u.nombre_usuario}</strong>
              {u.es_superadministrador&&<span className="user-superadmin-label">Superadministrador</span>}
            </div>
            <span className="user-item-username">{u.nombre_usuario} · {tipoLabel(u.tipo_cuenta)}</span>
            <span className="user-item-status">
              {u.estado==='activa'?'Activa':'Bloqueada'}
              {u.debe_cambiar_contrasena?' · Cambio de contraseña pendiente':''}
            </span>
            {!u.es_superadministrador&&<div className="user-item-actions">
              <button type="button" className="button ghost small" disabled={!!procesando}
                onClick={()=>restablecer(u)}>Restablecer clave</button>
              <button type="button" className={'button ghost small '+(u.estado==='activa'?'dangerous':'')}
                disabled={!!procesando} onClick={()=>cambiarEstado(u)}>
                {u.estado==='activa'?'Bloquear':'Habilitar'}
              </button>
            </div>}
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}
