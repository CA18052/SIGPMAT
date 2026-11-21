import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, requestApi } from './api';

type Area={
  id_departamento:string;departamento:string;turnos:number;abiertos:number;
  cancelados:number;cupos:number;cubiertos:number;faltantes:number
};
type Totales=Omit<Area,'id_departamento'|'departamento'>;
type Reporte={
  desde:string;hasta:string;totales:Totales;departamentos:Area[];
  porcentaje:number;nota:string
};
function localDia(fecha:Date){
  const dos=(n:number)=>String(n).padStart(2,'0');
  return fecha.getFullYear()+'-'+dos(fecha.getMonth()+1)+'-'+dos(fecha.getDate());
}
function inicio(){
  const f=new Date();f.setDate(f.getDate()-7);return localDia(f);
}
function final(){
  const f=new Date();f.setDate(f.getDate()+30);return localDia(f);
}
function celdaCsv(v:unknown){
  let s=String(v??'');
  // CSV seguro frente a inyección de fórmulas al abrir con Excel/Sheets.
  if (/^[\s]*[=+\-@]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function descargarCsv(reporte:Reporte){
  const filas=[
    ['Departamento','Turnos registrados','Abiertos','Cancelados',
      'Cupos requeridos','Personal asignado','Cupos sin cubrir','Cobertura (%)'],
    ...reporte.departamentos.map(a=>[
      a.departamento,a.turnos,a.abiertos,a.cancelados,a.cupos,a.cubiertos,a.faltantes,
      a.cupos>0?Math.round(a.cubiertos*100/a.cupos):0
    ]),
    ['TOTAL',reporte.totales.turnos,reporte.totales.abiertos,reporte.totales.cancelados,
      reporte.totales.cupos,reporte.totales.cubiertos,reporte.totales.faltantes,reporte.porcentaje]
  ];
  const csv='\uFEFF'+filas.map(f=>f.map(celdaCsv).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');
  a.href=url;a.download='SIGPMAT_Cobertura_'+reporte.desde+'_'+reporte.hasta+'.csv';
  document.body.appendChild(a);a.click();a.remove();
  URL.revokeObjectURL(url);
}
function porcentaje(a:Area){return a.cupos>0?Math.round(a.cubiertos*100/a.cupos):0;}
export default function Reportes({
  token,onSesionExpirada
}:{token:string;onSesionExpirada:()=>void}){
  const [desde,setDesde]=useState(inicio);
  const [hasta,setHasta]=useState(final);
  const [periodo,setPeriodo]=useState({desde:inicio(),hasta:final()});
  const [reporte,setReporte]=useState<Reporte|null>(null);
  const [cargando,setCargando]=useState(true);
  const [error,setError]=useState('');
  const cargar=useCallback(async()=>{
    setCargando(true);setError('');
    try{
      const q=new URLSearchParams(periodo);
      const res=await requestApi<Reporte>('/api/reportes/cobertura?'+q.toString(),token);
      setReporte(res);
    }catch(e){
      if(e instanceof ApiError&&e.status===401){onSesionExpirada();return;}
      setError(e instanceof Error?e.message:'No se pudo consultar la cobertura.');
    }finally{setCargando(false);}
  },[periodo,token,onSesionExpirada]);
  useEffect(()=>{void cargar();},[cargar]);
  const progreso=useMemo(()=>(reporte?.departamentos||[]).filter(a=>a.cupos>0),[reporte]);
  function aplicar(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(desde>hasta){setError('La fecha inicial no puede ser posterior a la final.');return;}
    if((Date.parse(hasta)-Date.parse(desde))/86400000>366){
      setError('El período no puede superar 367 días.');return;
    }
    setPeriodo({desde,hasta});
  }
  return <div className="report-view">
    <section className="report-hero panel">
      <div>
        <span className="eyebrow">ANÁLISIS HOSPITALARIO</span>
        <h2>Indicadores de cobertura</h2>
        <p>Analiza la distribución de turnos y detecta áreas con necesidades de personal, usando cifras reales de PostgreSQL.</p>
      </div>
      <form className="report-period" onSubmit={aplicar}>
        <label>Desde<input type="date" required value={desde} onChange={e=>setDesde(e.target.value)}/></label>
        <label>Hasta<input type="date" required value={hasta} onChange={e=>setHasta(e.target.value)}/></label>
        <button type="submit" className="button primary" disabled={cargando}>Consultar</button>
      </form>
    </section>
    {error&&<div role="alert" className="alert">{error}</div>}
    {cargando&&<div role="status" className="report-loading">
      <span className="report-skeleton"/><span className="report-skeleton"/><span className="report-skeleton"/>
      <p>Calculando cobertura por departamento…</p>
    </div>}
    {!cargando&&reporte&&<>
      <div className="report-metrics">
        <div className="report-metric"><span>Turnos del período</span><strong>{reporte.totales.turnos}</strong><small>{reporte.totales.abiertos} abiertos</small></div>
        <div className="report-metric"><span>Cupos solicitados</span><strong>{reporte.totales.cupos}</strong><small>En turnos abiertos</small></div>
        <div className="report-metric"><span>Personal asignado</span><strong>{reporte.totales.cubiertos}</strong><small>Asignaciones activas</small></div>
        <div className="report-metric attention"><span>Cupos sin cubrir</span><strong>{reporte.totales.faltantes}</strong><small>Requieren planificación</small></div>
      </div>
      <div className="report-panels">
        <section className="panel report-progress-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">POR DEPARTAMENTO</span>
              <h2>Estado de cobertura</h2><p>Porcentaje de cupos atendidos en turnos abiertos.</p></div>
          </div>
          <div className="report-progress">
            {progreso.length===0&&<p className="report-empty">No hay turnos abiertos con cupos en estas fechas. Prueba otro período.</p>}
            {progreso.map(a=><div key={a.id_departamento} className="report-progress-item">
              <div className="report-progress-text">
                <strong>{a.departamento}</strong>
                <span>{a.cubiertos}/{a.cupos} cupos · {porcentaje(a)}%</span>
              </div>
              <div className="report-track" role="meter" aria-label={'Cobertura de '+a.departamento}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(porcentaje(a),100)}>
                <div className={'report-fill'+(porcentaje(a)<50?' low':'')} style={{width:Math.min(porcentaje(a),100)+'%'}}/>
              </div>
            </div>)}
          </div>
        </section>
        <section className="panel report-summary-panel">
          <span className="eyebrow">VISIÓN GENERAL</span>
          <h3>Cobertura del período</h3>
          <div className="report-ring" role="img" aria-label={reporte.porcentaje+' por ciento de cobertura'}
            style={{background:'conic-gradient(#9a4567 '+Math.min(reporte.porcentaje,100)+'%,#eee6eb 0)'}}>
            <div><strong>{reporte.porcentaje}%</strong><span>de cobertura</span></div>
          </div>
          <p>{reporte.totales.faltantes===0
            ? 'Los turnos abiertos del período no presentan cupos pendientes.'
            : 'Existen '+reporte.totales.faltantes+' cupos pendientes. En Turnos puedes consultar propuestas de candidatos elegibles.'}</p>
          <div className="report-note">Los turnos cancelados no se incluyen en el cálculo de cobertura.</div>
        </section>
      </div>
      <section className="panel report-table-panel">
        <div className="panel-heading wrap-heading">
          <div><span className="eyebrow">DETALLE Y EXPORTACIÓN</span><h2>Resumen departamental</h2>
            <p>{reporte.departamentos.length} departamentos visibles según tu perfil.</p></div>
          <div className="report-export-actions">
            <button type="button" className="button ghost small" onClick={()=>window.print()}>
              Imprimir / Guardar PDF
            </button>
            <button type="button" className="button ghost small" onClick={()=>descargarCsv(reporte)}>
              Descargar CSV
            </button>
          </div>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Departamento</th><th>Turnos</th><th>Cupos</th>
            <th>Asignados</th><th>Sin cubrir</th><th>Cobertura</th></tr></thead>
          <tbody>{reporte.departamentos.map(a=><tr key={a.id_departamento}>
            <td><strong>{a.departamento}</strong></td><td>{a.turnos}</td>
            <td>{a.cupos}</td><td>{a.cubiertos}</td><td>{a.faltantes}</td>
            <td><span className={'status '+(porcentaje(a)>=80?'status-green':'status-amber')}>{a.cupos>0?porcentaje(a)+'%':'Sin cupos'}</span></td>
          </tr>)}</tbody>
        </table></div>
        <p className="report-data-source">Fuente: asignaciones y requerimientos guardados en SIGPMAT. Cifras del {reporte.desde} al {reporte.hasta}. No incluye DUI ni información de contacto.</p>
      </section>
    </>}
  </div>;
}
