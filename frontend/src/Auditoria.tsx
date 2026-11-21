import { useCallback, useEffect, useState } from 'react';
import { ApiError, requestApi } from './api';
type Evento = {
  id_auditoria:string;fecha_at:string;nombre_usuario:string|null;
  metodo:string;ruta:string;resultado:'EXITOSO'|'RECHAZADO'|'ERROR';
  codigo_http:number;campos_afectados:string[];request_id:string|null;
};
const acciones:Record<string,string>={POST:'Creación',PATCH:'Modificación',PUT:'Actualización',DELETE:'Eliminación'};
const fecha=(iso:string)=>new Date(iso).toLocaleString('es-SV',{dateStyle:'medium',timeStyle:'short'});
function recurso(path:string){
  const nombre=path.replace(/^\/api\//,'').replace(/\/\d+(?=\/|$)/g,'/#');
  return nombre.replaceAll('/',' › ');
}
export default function Auditoria({
  token,onSesionExpirada
}:{token:string;onSesionExpirada:()=>void}){
  const [eventos,setEventos]=useState<Evento[]>([]);
  const [error,setError]=useState('');
  const [cargando,setCargando]=useState(true);
  const cargar=useCallback(async()=>{
    setError('');setCargando(true);
    try{
      const r=await requestApi<{eventos:Evento[]}>('/api/admin/auditoria?limite=100',token);
      setEventos(r.eventos);
    }catch(e){
      if(e instanceof ApiError&&e.status===401){onSesionExpirada();return;}
      setError(e instanceof Error?e.message:'No se pudo consultar la bitácora.');
    }finally{setCargando(false);}
  },[token,onSesionExpirada]);
  useEffect(()=>{void cargar();},[cargar]);
  return <section className="panel audit-panel">
    <div className="panel-heading wrap-heading">
      <div><span className="eyebrow">SEGURIDAD Y TRAZABILIDAD</span>
        <h2>Bitácora de cambios</h2>
        <p>Solo el superadministrador puede consultar este historial. Se registran operaciones y resultados, nunca contraseñas ni datos sensibles.</p>
      </div>
      <button type="button" className="button ghost small" disabled={cargando} onClick={()=>void cargar()}>Actualizar bitácora</button>
    </div>
    {error&&<div className="alert" role="alert">{error}</div>}
    {cargando&&<p className="audit-empty">Consultando eventos…</p>}
    {!cargando&&eventos.length===0&&<p className="audit-empty">Todavía no hay operaciones registradas.</p>}
    {!cargando&&eventos.length>0&&<>
      <div className="table-wrap audit-desktop">
        <table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Operación</th>
          <th>Módulo / registro</th><th>Campos</th><th>Resultado</th></tr></thead>
          <tbody>{eventos.map(e=><tr key={e.id_auditoria}>
            <td>{fecha(e.fecha_at)}</td>
            <td className="mono">{e.nombre_usuario||'Sin identificar'}</td>
            <td>{acciones[e.metodo]||e.metodo}</td>
            <td><span className="audit-route">{recurso(e.ruta)}</span></td>
            <td>{e.campos_afectados.join(', ')||'—'}</td>
            <td><span className={'status '+(e.resultado==='EXITOSO'?'status-green':'status-amber')}>
              {e.resultado} · {e.codigo_http}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="audit-mobile">{eventos.map(e=><article className="audit-card" key={e.id_auditoria}>
        <div className="audit-card-heading"><strong>{e.nombre_usuario||'Sin identificar'}</strong><span>{fecha(e.fecha_at)}</span></div>
        <div>{acciones[e.metodo]||e.metodo} · {recurso(e.ruta)}</div>
        <small>Campos: {e.campos_afectados.join(', ')||'Sin campos específicos'}</small>
        <small>{e.resultado} · HTTP {e.codigo_http}</small>
      </article>)}</div>
    </>}
    <p className="audit-foot">Se muestran hasta 100 eventos recientes. Los registros no pueden editarse ni eliminarse desde esta interfaz.</p>
  </section>;
}
