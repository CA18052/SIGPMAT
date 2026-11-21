import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, requestApi } from './api';

type Propuesta={
  ticket:string;resumen:string;tipo:'crear_turno'|'crear_empleado'|'asignar_empleado';
  expira_en_segundos:number
};
type Mensaje={id:number;rol:'usuario'|'aura';contenido:string;
  propuesta?:Propuesta;completada?:boolean};
type Estado={habilitada:boolean;modelo:string|null;mensaje:string};
type Chat={respuesta:string;modelo:string;propuesta:Propuesta|null;aviso:string};
type Ejecucion={ejecutado:boolean;tipo:string;resumen:string;
  resultado:Record<string,unknown>;mensaje:string};
const ejemplos=[
  '¿Cuáles son los departamentos con más cupos sin cubrir este mes?',
  '¿Qué médicos están libres mañana en Cirugía General?',
  '¿Qué personal se recomienda para el turno 9?',
  'Ayúdame a preparar un nuevo turno de dos médicos'
];
const fecha=(d:Date)=>d.toLocaleTimeString('es-SV',{hour:'2-digit',minute:'2-digit'});
function resultadoAccion(e:Ejecucion){
  const turno=e.resultado?.turno as {id_turno?:string;id_requerimiento?:string}|undefined;
  const empleado=e.resultado?.empleado as {codigo_empleado?:string}|undefined;
  const asignacion=e.resultado?.asignacion as {id_asignacion?:string}|undefined;
  return e.mensaje+(turno?.id_turno?' Turno #'+turno.id_turno+
    (turno.id_requerimiento?' · Requerimiento #'+turno.id_requerimiento:'')+'.':'')+
    (empleado?.codigo_empleado?' Empleado '+empleado.codigo_empleado+'.':'')+
    (asignacion?.id_asignacion?' Asignación #'+asignacion.id_asignacion+'.':'');
}

export default function AURA({
  token,abierto,onCerrar,onSesionExpirada,onDatosActualizados,soloLectura
}:{
  token:string;abierto:boolean;onCerrar:()=>void;onSesionExpirada:()=>void;
  onDatosActualizados:()=>void;soloLectura:boolean
}){
  const [estado,setEstado]=useState<Estado|null>(null);
  const [mensajes,setMensajes]=useState<Mensaje[]>([{
    id:0,rol:'aura',
    contenido:'¡Hola! Soy AURA, tu copiloto de SIGPMAT. Puedo analizar turnos, consultar cobertura y ayudarte a preparar operaciones autorizadas. ¿Qué necesitas hoy?'
  }]);
  const [texto,setTexto]=useState('');
  const [enviando,setEnviando]=useState(false);
  const [ejecutando,setEjecutando]=useState(false);
  const [error,setError]=useState('');
  const finRef=useRef<HTMLDivElement|null>(null);
  const textareaRef=useRef<HTMLTextAreaElement|null>(null);
  const idRef=useRef(1);
  const estadoRef=useRef(abierto);
  estadoRef.current=abierto;

  useEffect(()=>{
    let vivo=true;
    requestApi<Estado>('/api/aura/estado',token).then(r=>{
      if(vivo)setEstado(r);
    }).catch(e=>{
      if(!vivo)return;
      if(e instanceof ApiError&&e.status===401){onSesionExpirada();return;}
      setError(e instanceof Error?e.message:'No se pudo consultar el estado del asistente.');
    });
    return()=>{vivo=false;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[token]);

  useEffect(()=>{if(abierto)finRef.current?.scrollIntoView({block:'end',behavior:'smooth'});},
    [abierto,mensajes,enviando]);
  useEffect(()=>{
    if(!abierto)return;
    const escucha=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!ejecutando)onCerrar();};
    window.addEventListener('keydown',escucha);
    return()=>window.removeEventListener('keydown',escucha);
  },[abierto,ejecutando,onCerrar]);
  useEffect(()=>{if(abierto)textareaRef.current?.focus();},[abierto]);

  async function enviar(pregunta:string){
    const preguntaLimpia=pregunta.trim().slice(0,1500);
    if(!preguntaLimpia||enviando||ejecutando||!estado?.habilitada)return;
    setError('');setTexto('');setEnviando(true);
    const historial=mensajes.slice(-8).map(m=>({rol:m.rol,contenido:m.contenido.slice(0,1100)}));
    const nuevo:Mensaje={id:idRef.current++,rol:'usuario',contenido:preguntaLimpia};
    setMensajes(prev=>[...prev,nuevo]);
    try{
      const respuesta=await requestApi<Chat>('/api/aura/mensaje',token,{
        method:'POST',body:JSON.stringify({mensaje:preguntaLimpia,historial})
      });
      setMensajes(prev=>[...prev,{id:idRef.current++,rol:'aura',
        contenido:respuesta.respuesta,propuesta:respuesta.propuesta??undefined}]);
    }catch(e){
      if(e instanceof ApiError&&e.status===401){onSesionExpirada();return;}
      setError(e instanceof Error?e.message:'AURA no pudo procesar la consulta.');
    }finally{setEnviando(false);}
  }

  async function ejecutar(id:number,propuesta:Propuesta){
    if(enviando||ejecutando||soloLectura)return;
    if(!window.confirm('¿Apruebas esta operación de SIGPMAT?\n\n'+propuesta.resumen+
      '\n\nSe verificará tu contraseña antes de guardar.'))return;
    setError('');setEjecutando(true);
    try{
      const respuesta=await requestApi<Ejecucion>('/api/aura/ejecutar',token,{
        method:'POST',body:JSON.stringify({ticket:propuesta.ticket})
      });
      setMensajes(prev=>prev.map(m=>m.id===id?{...m,completada:true}:m)
        .concat({id:idRef.current++,rol:'aura',contenido:resultadoAccion(respuesta)}));
      onDatosActualizados();
    }catch(e){
      if(e instanceof ApiError&&e.status===401){onSesionExpirada();return;}
      setError(e instanceof Error?e.message:'No se pudo guardar la operación.');
    }finally{setEjecutando(false);}
  }

  if(!abierto)return null;
  return <div className="aura-overlay" role="presentation" onMouseDown={e=>{
    if(e.currentTarget===e.target&&!ejecutando)onCerrar();
  }}>
    <section className="aura-window" role="dialog" aria-modal="true" aria-labelledby="aura-titulo">
      <header className="aura-header">
        <div className="aura-identity">
          <span className="aura-emblem" aria-hidden="true">✧</span>
          <div><strong id="aura-titulo">AURA</strong>
            <small>Asistente de recursos y asignaciones</small></div>
        </div>
        <div className="aura-header-actions">
          <span className={'aura-status-dot'+(estado?.habilitada?' online':'')}/>
          <button type="button" className="aura-close" aria-label="Cerrar AURA"
            onClick={onCerrar}>✕</button>
        </div>
      </header>
      <div className="aura-intro">
        <span className="aura-eyebrow">COPILOTO HOSPITALARIO</span>
        <h2>Una forma más inteligente de trabajar.</h2>
        <p>Consulta disponibilidad, analiza cobertura y prepara acciones con aprobación humana.</p>
      </div>
      <div className="aura-scroll" aria-live="polite" aria-relevant="additions">
        {estado&&!estado.habilitada&&<div role="status" className="aura-config-alert">
          <strong>Falta conectar el motor de inteligencia artificial</strong>
          <p>Para activar AURA, el administrador debe configurar la variable privada
            <code> OPENAI_API_KEY </code> en Render y publicar el servicio. No se simularán respuestas de IA.</p>
        </div>}
        {mensajes.map(m=><article key={m.id} className={'aura-message '+(m.rol==='usuario'?'from-user':'from-aura')}>
          {m.rol==='aura'&&<span className="aura-message-avatar" aria-hidden="true">✧</span>}
          <div className="aura-message-body">
            <p>{m.contenido}</p>
            {m.propuesta&&<div className="aura-proposal">
              <div className="aura-proposal-top">
                <span className="aura-proposal-label">PROPUESTA · SIN GUARDAR</span>
                <span>5 MIN</span>
              </div>
              <strong>{m.propuesta.resumen}</strong>
              <small>La base de datos no cambia hasta que apruebes y confirmes tu contraseña.</small>
              <button type="button" className="aura-approve"
                disabled={m.completada||ejecutando||enviando||soloLectura}
                onClick={()=>void ejecutar(m.id,m.propuesta!)}>
                {m.completada?'✓ Operación ejecutada':
                  ejecutando?'Verificando…':'Revisar y ejecutar'}
              </button>
            </div>}
            <span className="aura-message-time">
              {m.rol==='aura'?'AURA':'Tú'} · {fecha(new Date())}
            </span>
          </div>
        </article>)}
        {enviando&&<div className="aura-typing" role="status">
          <span className="aura-message-avatar">✧</span>
          <div><i/><i/><i/></div><small>Analizando tu solicitud…</small>
        </div>}
        <div ref={finRef}/>
      </div>
      {error&&<div className="aura-error" role="alert"><span>{error}</span>
        <button type="button" onClick={()=>setError('')} aria-label="Cerrar aviso">✕</button>
      </div>}
      {mensajes.length<4&&<div className="aura-suggestions">
        {ejemplos.slice(0,soloLectura?2:4).map(p=>
          <button type="button" key={p} onClick={()=>void enviar(p)}
            disabled={!estado?.habilitada||enviando||ejecutando}>{p}</button>)}
      </div>}
      <form className="aura-compose" onSubmit={(e:FormEvent<HTMLFormElement>)=>{
        e.preventDefault();void enviar(texto);
      }}>
        <label className="sr-only" htmlFor="aura-pregunta">Escribe a AURA</label>
        <textarea id="aura-pregunta" ref={textareaRef} rows={2} maxLength={1500}
          value={texto} placeholder={estado?.habilitada?'Pregunta o describe lo que necesitas…':'Configura la API para conversar…'}
          disabled={!estado?.habilitada||enviando||ejecutando}
          onChange={e=>setTexto(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){
            e.preventDefault();void enviar(texto);
          }}}/>
        <button type="submit" aria-label="Enviar mensaje a AURA"
          disabled={!estado?.habilitada||enviando||ejecutando||!texto.trim()}>
          <span aria-hidden="true">↗</span>
        </button>
      </form>
      <footer className="aura-disclaimer">
        AURA puede equivocarse. No compartas DUI, teléfonos ni contraseñas.
        Las acciones requieren autorización.
      </footer>
    </section>
  </div>;
}
