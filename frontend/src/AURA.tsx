import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, requestApi } from './api';
import AuraTexto from './AuraTexto';

type Propuesta={
  ticket:string;resumen:string;tipo:'crear_turno'|'crear_empleado'|'asignar_empleado';
  expira_en_segundos:number
};
type Mensaje={id:number;rol:'usuario'|'aura';contenido:string;creadoEn:number;
  propuesta?:Propuesta;propuestaVenceEn?:number;completada?:boolean};
type Estado={habilitada:boolean;modelo:string|null;proveedor?:string;mensaje:string};
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
    id:0,rol:'aura',creadoEn:Date.now(),
    contenido:'¡Hola! Soy AURA, tu copiloto de SIGPMAT. Puedo analizar turnos, consultar cobertura y ayudarte a preparar operaciones autorizadas. ¿Qué necesitas hoy?'
  }]);
  const [texto,setTexto]=useState('');
  const [enviando,setEnviando]=useState(false);
  const [ejecutando,setEjecutando]=useState(false);
  const [error,setError]=useState('');
  const [reloj,setReloj]=useState(Date.now);
  const [revision,setRevision]=useState<{id:number;propuesta:Propuesta}|null>(null);
  const finRef=useRef<HTMLDivElement|null>(null);
  const textareaRef=useRef<HTMLTextAreaElement|null>(null);
  const revisionRef=useRef<HTMLElement|null>(null);
  const aceptarRef=useRef<HTMLButtonElement|null>(null);
  const idRef=useRef(1);

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
    const escucha=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){
        if(revision){e.preventDefault();setRevision(null);}
        else if(!ejecutando)onCerrar();
      }
      if(e.key==='Tab'&&revision){
        const controles=revisionRef.current?.querySelectorAll<HTMLButtonElement>(
          'button:not([disabled])');
        if(!controles?.length)return;
        const primero=controles[0],ultimo=controles[controles.length-1];
        if(e.shiftKey&&document.activeElement===primero){
          e.preventDefault();ultimo.focus();
        }else if(!e.shiftKey&&document.activeElement===ultimo){
          e.preventDefault();primero.focus();
        }
      }
    };
    window.addEventListener('keydown',escucha);
    return()=>window.removeEventListener('keydown',escucha);
  },[abierto,ejecutando,onCerrar,revision]);
  useEffect(()=>{if(abierto)textareaRef.current?.focus();},[abierto]);
  useEffect(()=>{if(revision)aceptarRef.current?.focus();},[revision]);
  // Tiempo real de vencimiento: no ofrecer operaciones con tickets caducados.
  useEffect(()=>{
    if(!abierto||!mensajes.some(m=>m.propuesta&&!m.completada))return;
    const intervalo=window.setInterval(()=>setReloj(Date.now()),5000);
    return()=>window.clearInterval(intervalo);
  },[abierto,mensajes]);

  async function enviar(pregunta:string){
    const preguntaLimpia=pregunta.trim().slice(0,1500);
    if(!preguntaLimpia||enviando||ejecutando||!estado?.habilitada)return;
    setError('');setTexto('');setEnviando(true);
    const historial=mensajes.slice(-8).map(m=>({rol:m.rol,contenido:m.contenido.slice(0,1100)}));
    const nuevo:Mensaje={id:idRef.current++,rol:'usuario',contenido:preguntaLimpia,creadoEn:Date.now()};
    setMensajes(prev=>[...prev,nuevo]);
    try{
      const respuesta=await requestApi<Chat>('/api/aura/mensaje',token,{
        method:'POST',body:JSON.stringify({mensaje:preguntaLimpia,historial})
      });
      const ahora=Date.now();
      setMensajes(prev=>[...prev,{id:idRef.current++,rol:'aura',creadoEn:ahora,
        contenido:respuesta.respuesta,propuesta:respuesta.propuesta??undefined,
        propuestaVenceEn:respuesta.propuesta
          ? ahora+respuesta.propuesta.expira_en_segundos*1000 : undefined}]);
    }catch(e){
      if(e instanceof ApiError&&e.status===401){onSesionExpirada();return;}
      setError(e instanceof Error?e.message:'AURA no pudo procesar la consulta.');
    }finally{setEnviando(false);}
  }

  async function ejecutar(id:number,propuesta:Propuesta){
    if(enviando||ejecutando||soloLectura)return;
    const mensaje=mensajes.find(m=>m.id===id);
    if(!mensaje||mensaje.completada||!mensaje.propuestaVenceEn||
      Date.now()>=mensaje.propuestaVenceEn){
      setRevision(null);
      setError('La propuesta venció. Pídele a AURA que prepare una nueva antes de continuar.');
      return;
    }
    setRevision(null);
    setError('');setEjecutando(true);
    try{
      const respuesta=await requestApi<Ejecucion>('/api/aura/ejecutar',token,{
        method:'POST',body:JSON.stringify({ticket:propuesta.ticket})
      });
      setMensajes(prev=>prev.map(m=>m.id===id?{...m,completada:true}:m)
        .concat({id:idRef.current++,rol:'aura',contenido:resultadoAccion(respuesta),
          creadoEn:Date.now()}));
      onDatosActualizados();
    }catch(e){
      if(e instanceof ApiError&&e.status===401){onSesionExpirada();return;}
      setError(e instanceof Error?e.message:'No se pudo guardar la operación.');
    }finally{setEjecutando(false);}
  }

  if(!abierto)return null;
  return <div className="aura-overlay" role="presentation" onMouseDown={e=>{
    if(e.currentTarget===e.target&&!ejecutando&&!revision)onCerrar();
  }}>
    <section className="aura-window" role="dialog" aria-modal="true" aria-labelledby="aura-titulo">
      <header className="aura-header">
        <div className="aura-identity">
          <span className="aura-emblem" aria-hidden="true">✧</span>
          <div><strong id="aura-titulo">AURA</strong>
            <small>Asistente de recursos y asignaciones</small></div>
        </div>
        <div className="aura-header-actions">
          <span className={'aura-status-dot'+(estado?.habilitada?' online':'')}
            role="status" aria-label={estado?.habilitada
              ? 'Proveedor configurado; conexión verificada al realizar una consulta'
              : 'Proveedor de IA sin configurar'}/>
          <button type="button" className="aura-close" aria-label="Cerrar AURA"
            onClick={onCerrar}>✕</button>
        </div>
      </header>
      <div className={'aura-intro'+(mensajes.length>1?' compact':'')}>
        <span className="aura-eyebrow">COPILOTO HOSPITALARIO</span>
        {mensajes.length===1 ? <>
          <h2>Una forma más inteligente de trabajar.</h2>
          <p>Consulta disponibilidad, analiza cobertura y prepara acciones con aprobación humana.</p>
        </> : <p>Consulta, planifica y autoriza con información verificada de SIGPMAT.</p>}
      </div>
      <div className="aura-scroll" role="log" aria-live="polite" aria-relevant="additions">
        {estado&&!estado.habilitada&&<div role="status" className="aura-config-alert">
          <strong>Conecta AURA con GroqCloud gratis</strong>
          <p>Para activar el asistente sin pagar la API de OpenAI, configura
            <code> GROQ_API_KEY </code> en las variables privadas de Render.
            No se mostrarán respuestas simuladas.</p>
        </div>}
        {mensajes.map(m=><article key={m.id} className={'aura-message '+(m.rol==='usuario'?'from-user':'from-aura')}>
          {m.rol==='aura'&&<span className="aura-message-avatar" aria-hidden="true">✧</span>}
          <div className="aura-message-body">
            {m.rol==='aura'
              ? <AuraTexto texto={m.contenido}/>
              : <p className="aura-user-text">{m.contenido}</p>}
            {m.propuesta&&<div className="aura-proposal">
              <div className="aura-proposal-top">
                <span className="aura-proposal-label">
                  {m.completada?'PROPUESTA · EJECUTADA':
                    m.propuestaVenceEn!==undefined&&reloj>=m.propuestaVenceEn
                      ?'PROPUESTA · CADUCADA':'PROPUESTA · SIN GUARDAR'}
                </span>
                <span>{m.completada?'CONFIRMADA':
                  m.propuestaVenceEn!==undefined&&reloj>=m.propuestaVenceEn
                    ?'VENCIDA':
                      Math.max(1,Math.ceil(((m.propuestaVenceEn??reloj)-reloj)/60000))+' MIN'}</span>
              </div>
              <strong>{m.propuesta.resumen}</strong>
              <small>{m.completada
                ? 'La operación fue confirmada por SIGPMAT.'
                : m.propuestaVenceEn!==undefined&&reloj>=m.propuestaVenceEn
                  ? 'La autorización de esta propuesta ha caducado. Solicita una nueva.'
                  : 'La base de datos no cambia hasta que apruebes y confirmes tu contraseña.'}</small>
              <button type="button" className="aura-approve"
                disabled={m.completada||ejecutando||enviando||soloLectura||
                  (m.propuestaVenceEn!==undefined&&reloj>=m.propuestaVenceEn)}
                onClick={()=>{
                   setReloj(Date.now());
                   setRevision({id:m.id,propuesta:m.propuesta!});
                 }}>
                {m.completada?'✓ Operación ejecutada':
                  m.propuestaVenceEn!==undefined&&reloj>=m.propuestaVenceEn
                    ? 'Propuesta caducada'
                    : ejecutando?'Verificando…':'Revisar y ejecutar'}
              </button>
            </div>}
            <span className="aura-message-time">
              {m.rol==='aura'?'AURA':'Tú'} · {fecha(new Date(m.creadoEn))}
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
      {mensajes.length===1&&<div className="aura-suggestions">
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
      {revision&&<div className="aura-review-layer" role="presentation">
        <section ref={revisionRef} className="aura-review-dialog" role="alertdialog"
          aria-modal="true" aria-labelledby="aura-review-titulo"
          aria-describedby="aura-review-detalle">
          <div className="aura-review-icon" aria-hidden="true">✓</div>
          <span className="aura-eyebrow">VERIFICACIÓN DE CAMBIO</span>
          <h2 id="aura-review-titulo">Revisa antes de confirmar</h2>
          <p id="aura-review-detalle">{revision.propuesta.resumen}</p>
          <div className="aura-review-security">
            <strong>Acción supervisada</strong>
            <span>No se ha guardado ningún cambio. SIGPMAT comprobará
              tus permisos y solicitará tu contraseña actual.</span>
          </div>
          <div className="aura-review-actions">
            <button type="button" className="aura-review-cancel"
              onClick={()=>setRevision(null)}>Cancelar</button>
            <button ref={aceptarRef} type="button" className="aura-approve"
              disabled={mensajes.some(m=>m.id===revision.id &&
                m.propuestaVenceEn!==undefined&&reloj>=m.propuestaVenceEn)}
              onClick={()=>void ejecutar(revision.id,revision.propuesta)}>
              Aprobar y verificar contraseña
            </button>
          </div>
        </section>
      </div>}
    </section>
  </div>;
}
