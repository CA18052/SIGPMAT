import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, requestApi } from './api';
import type { Departamento, Empleado } from './api';

type Cargo = { id_cargo: string; nombre: string; categoria: string };
type Especialidad = { id_especialidad: string; nombre: string; codigo: string };
type Turno = {
  id_turno: string; id_departamento: string; departamento: string;
  tipo_turno: string; inicio_at: string; fin_at: string; estado: string;
  cupos_requeridos: number; cupos_ocupados: number;
};
type Requerimiento = {
  id_requerimiento: string; id_cargo: string; cargo: string;
  id_especialidad: string | null; especialidad: string | null;
  cupos_requeridos: number; cupos_ocupados: number; prioridad: string;
};
type Asignacion = {
  id_asignacion: string; id_requerimiento: string; id_empleado: string;
  codigo_empleado: string; nombres: string; apellidos: string; estado: string;
};
type DetalleTurno = {
  turno: Turno; requerimientos: Requerimiento[]; asignaciones: Asignacion[];
};
type Formulario = {
  id_departamento: string; id_cargo: string; id_especialidad: string;
  tipo_turno: string; inicio_at: string; fin_at: string;
  cupos_requeridos: string; prioridad: string;
};

const formatoFecha = new Intl.DateTimeFormat('es-SV', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true
});
const textoFecha = (fecha: string) => formatoFecha.format(new Date(fecha));

function localFecha(fecha: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return fecha.getFullYear() + '-' + p(fecha.getMonth() + 1) + '-' +
    p(fecha.getDate()) + 'T' + p(fecha.getHours()) + ':' + p(fecha.getMinutes());
}

function formInicial(): Formulario {
  const inicio = new Date(Date.now() + 86400000);
  inicio.setHours(8, 0, 0, 0);
  const fin = new Date(inicio.getTime() + 8 * 60 * 60 * 1000);
  return {
    id_departamento: '', id_cargo: '', id_especialidad: '',
    tipo_turno: 'diurno', inicio_at: localFecha(inicio),
    fin_at: localFecha(fin), cupos_requeridos: '1', prioridad: 'normal'
  };
}

export default function Turnos({
  token, departamentos, onSesionExpirada, esAdmin
}: {
  token: string; departamentos: Departamento[]; onSesionExpirada: () => void; esAdmin: boolean;
}) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [formulario, setFormulario] = useState<Formulario>(formInicial);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoTurnoId, setEditandoTurnoId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleTurno | null>(null);
  const [candidatos, setCandidatos] = useState<Empleado[]>([]);
  const [seleccion, setSeleccion] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  function errorApi(e: unknown) {
    if (e instanceof ApiError && e.status === 401) {
      onSesionExpirada();
      return;
    }
    setError(e instanceof Error ? e.message : 'No se pudo completar la operación');
  }

  async function cargarListado() {
    const resultado = await requestApi<{ turnos: Turno[] }>('/api/turnos', token);
    setTurnos(resultado.turnos);
  }

  useEffect(() => {
    let activo = true;
    Promise.all([
      requestApi<{ turnos: Turno[] }>('/api/turnos', token),
      requestApi<{ cargos: Cargo[] }>('/api/cargos', token),
      requestApi<{ especialidades: Especialidad[] }>('/api/especialidades', token)
    ]).then(([t, c, s]) => {
      if (!activo) return;
      setTurnos(t.turnos); setCargos(c.cargos); setEspecialidades(s.especialidades);
    }).catch(e => { if (activo) errorApi(e); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
    // Se recargará al cambiar la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const listados = useMemo(() =>
    turnos.filter(t => !filtroArea || t.id_departamento === filtroArea),
    [turnos, filtroArea]
  );
  const abiertos = listados.filter(t => t.estado === 'abierto');
  const programados = abiertos.length;
  const cupos = abiertos.reduce((n, t) => n + t.cupos_requeridos, 0);
  const cubiertos = abiertos.reduce((n, t) => n + t.cupos_ocupados, 0);

  async function abrirTurno(id: string) {
    setError(''); setMensaje(''); setProcesando(true);
    try {
      const detalle = await requestApi<DetalleTurno>('/api/turnos/' + id, token);
      const lista = await requestApi<{ empleados: Empleado[] }>(
        '/api/empleados?departamento_id=' + detalle.turno.id_departamento, token
      );
      setDetalle(detalle); setCandidatos(lista.empleados); setSeleccion('');
    } catch (e) { errorApi(e); }
    finally { setProcesando(false); }
  }

  async function guardarTurno(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (procesando) return;
    setError(''); setMensaje(''); setProcesando(true);
    try {
      const inicio = new Date(formulario.inicio_at);
      const fin = new Date(formulario.fin_at);
      if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fin.getTime())) {
        throw new Error('Revisa las fechas del turno');
      }
      const payload = {
        id_departamento: formulario.id_departamento,
        id_cargo: formulario.id_cargo,
        id_especialidad: formulario.id_especialidad || null,
        tipo_turno: formulario.tipo_turno,
        inicio_at: inicio.toISOString(),
        fin_at: fin.toISOString(),
        cupos_requeridos: Number(formulario.cupos_requeridos),
        prioridad: formulario.prioridad
      };
      if (editandoTurnoId) {
        await requestApi('/api/turnos/' + editandoTurnoId, token,
          {method:'PATCH',body:JSON.stringify(payload)});
        await cargarListado();
        setMensaje('Turno actualizado correctamente.');
        setMostrarFormulario(false);setEditandoTurnoId(null);setFormulario(formInicial());
      } else {
        const resultado = await requestApi<{ turno: { id_turno: string } }>(
          '/api/turnos', token, {method:'POST',body:JSON.stringify(payload)});
        await cargarListado();
        setMostrarFormulario(false);setFormulario(formInicial());
        setMensaje('Turno creado. Ahora puedes asignar personal.');
        const nuevo = await requestApi<DetalleTurno>('/api/turnos/' + resultado.turno.id_turno,token);
        setDetalle(nuevo);
        const lista = await requestApi<{ empleados: Empleado[] }>(
          '/api/empleados?departamento_id=' + nuevo.turno.id_departamento,token);
        setCandidatos(lista.empleados);
      }
    } catch (e) { errorApi(e); }
    finally { setProcesando(false); }
  }

  function editarTurno() {
    if (!detalle || !esAdmin || procesando) return;
    if (detalle.requerimientos.length !== 1) {
      setError('Este turno contiene múltiples requerimientos; no admite edición desde este formulario.');
      return;
    }
    const t=detalle.turno, r=detalle.requerimientos[0];
    setFormulario({
      id_departamento:t.id_departamento,id_cargo:r.id_cargo,
      id_especialidad:r.id_especialidad || '',
      tipo_turno:t.tipo_turno,
      inicio_at:localFecha(new Date(t.inicio_at)),
      fin_at:localFecha(new Date(t.fin_at)),
      cupos_requeridos:String(r.cupos_requeridos),prioridad:r.prioridad
    });
    setEditandoTurnoId(t.id_turno);
    setDetalle(null);setMostrarFormulario(true);
    setError('');setMensaje('Editando turno #' + t.id_turno + '. Guarda en el formulario.');
  }

  async function eliminarTurno() {
    if (!detalle || !esAdmin || procesando) return;
    const id=detalle.turno.id_turno;
    if (!window.confirm('¿Eliminar definitivamente el turno #' + id +
      '? Solo si no tiene asignaciones o historial. No se puede deshacer.')) return;
    setProcesando(true);setError('');setMensaje('');
    try {
      await requestApi('/api/turnos/' + id,token,{method:'DELETE'});
      setDetalle(null);await cargarListado();
      setMensaje('Turno #' + id + ' eliminado correctamente.');
    }catch(e){errorApi(e);}
    finally{setProcesando(false);}
  }

  async function asignar(requerimiento: Requerimiento) {
    if (!detalle || !seleccion || procesando) return;
    setError(''); setMensaje(''); setProcesando(true);
    try {
      await requestApi('/api/turnos/' + detalle.turno.id_turno + '/asignaciones',token,{
        method: 'POST',
        body: JSON.stringify({
          id_requerimiento: requerimiento.id_requerimiento,
          id_empleado: seleccion
        })
      });
      const resultado = await requestApi<DetalleTurno>('/api/turnos/' + detalle.turno.id_turno,token);
      setDetalle(resultado);
      setSeleccion('');
      await cargarListado();
      setMensaje('Asignación registrada correctamente.');
    } catch (e) { errorApi(e); }
    finally { setProcesando(false); }
  }

  async function cancelarAsignacion(id: string) {
    if (!detalle || !window.confirm('¿Cancelar esta asignación?') || procesando) return;
    setError(''); setMensaje(''); setProcesando(true);
    try {
      await requestApi('/api/asignaciones/' + id + '/cancelar',token,{method:'PATCH'});
      setDetalle(await requestApi<DetalleTurno>('/api/turnos/' + detalle.turno.id_turno,token));
      await cargarListado();
      setMensaje('Asignación cancelada.');
    } catch (e) { errorApi(e); }
    finally { setProcesando(false); }
  }

  async function cancelarTurno() {
    if (!detalle || !window.confirm('¿Cancelar este turno? No debe tener asignaciones activas.') || procesando) return;
    setError(''); setMensaje(''); setProcesando(true);
    try {
      await requestApi('/api/turnos/' + detalle.turno.id_turno + '/cancelar',token,{method:'PATCH'});
      setDetalle(null);
      await cargarListado();
      setMensaje('Turno cancelado.');
    } catch (e) { errorApi(e); }
    finally { setProcesando(false); }
  }

  const r = detalle?.requerimientos[0] ?? null;
  const candidatosCompatibles = candidatos.filter(e => e.estado_vinculo === 'activo' &&
    (!r || e.cargo === r.cargo)
  );
  const ocupacion = cupos > 0 ? Math.round(cubiertos / cupos * 100) : 0;
  return (
    <div className="turnos-view">
      <section className="shift-toolbar">
        <div className="shift-intro">
          <span className="eyebrow">PLANIFICACIÓN</span>
          <h2>Calendario de turnos</h2>
          <p>Organiza los turnos, define los cupos y asigna personal por departamento.</p>
        </div>
        <button type="button" className="button primary" onClick={() => {
          if(mostrarFormulario){setMostrarFormulario(false);setEditandoTurnoId(null);setFormulario(formInicial());}
          else{setEditandoTurnoId(null);setFormulario(formInicial());setMostrarFormulario(true);}
          setError('');
        }}>
          {mostrarFormulario ? 'Cerrar formulario' : '+ Crear turno'}
        </button>
      </section>

      {mensaje && <div className="shift-success" role="status">✓ {mensaje}</div>}
      {error && <div className="alert" role="alert">! {error}</div>}

      <div className="shift-metrics">
        <div><span>Turnos abiertos</span><strong>{programados}</strong></div>
        <div><span>Cupos requeridos</span><strong>{cupos}</strong></div>
        <div><span>Personal asignado</span><strong>{cubiertos}</strong></div>
        <div><span>Cobertura de los turnos listados</span><strong>{ocupacion}%</strong></div>
      </div>

      {mostrarFormulario && <section className="panel shift-form-panel">
        <div className="eyebrow">NUEVO TURNO</div>
        <h3>{editandoTurnoId ? 'Modificar turno #' + editandoTurnoId : 'Programar cobertura'}</h3>
        <form onSubmit={guardarTurno} className="shift-form">
          <label>Departamento
            <select required value={formulario.id_departamento} onChange={e=>setFormulario(f=>({...f,id_departamento:e.target.value}))}>
              <option value="">Seleccionar departamento</option>
              {departamentos.map(d=><option key={d.id_departamento} value={d.id_departamento}>{d.nombre}</option>)}
            </select>
          </label>
          <label>Cargo requerido
            <select required value={formulario.id_cargo} onChange={e=>setFormulario(f=>({...f,id_cargo:e.target.value}))}>
              <option value="">Seleccionar cargo</option>
              {cargos.map(c=><option key={c.id_cargo} value={c.id_cargo}>{c.nombre}</option>)}
            </select>
          </label>
          <label>Tipo de turno
            <select value={formulario.tipo_turno} onChange={e=>setFormulario(f=>({...f,tipo_turno:e.target.value}))}>
              <option value="diurno">Diurno</option><option value="nocturno">Nocturno</option>
              <option value="mixto">Mixto</option><option value="emergencia">Emergencia</option>
            </select>
          </label>
          <label>Especialidad (opcional)
            <select value={formulario.id_especialidad} onChange={e=>setFormulario(f=>({...f,id_especialidad:e.target.value}))}>
              <option value="">Sin especialidad obligatoria</option>
              {especialidades.map(s=><option key={s.id_especialidad} value={s.id_especialidad}>{s.nombre}</option>)}
            </select>
          </label>
          <label>Inicio
            <input required type="datetime-local" value={formulario.inicio_at}
              onChange={e=>setFormulario(f=>({...f,inicio_at:e.target.value}))}/>
          </label>
          <label>Finalización
            <input required type="datetime-local" value={formulario.fin_at}
              onChange={e=>setFormulario(f=>({...f,fin_at:e.target.value}))}/>
          </label>
          <label>Cupos requeridos
            <input required type="number" min="1" max="200" value={formulario.cupos_requeridos}
              onChange={e=>setFormulario(f=>({...f,cupos_requeridos:e.target.value}))}/>
          </label>
          <label>Prioridad
            <select value={formulario.prioridad} onChange={e=>setFormulario(f=>({...f,prioridad:e.target.value}))}>
              <option value="normal">Normal</option><option value="alta">Alta</option><option value="critica">Crítica</option>
            </select>
          </label>
          <div className="shift-actions">
            <button className="button primary" type="submit" disabled={procesando}>
              {procesando ? 'Guardando…' : editandoTurnoId ? 'Guardar cambios' : 'Guardar turno'}
            </button>
            <p>{editandoTurnoId ? 'Solo se modifican turnos sin asignaciones históricas.' : 'Se crea un turno abierto con un requerimiento de cobertura.'}</p>
          </div>
        </form>
      </section>}

      <section className="panel shift-list-panel">
        <div className="panel-heading wrap-heading">
          <div><div className="eyebrow">PROGRAMACIÓN</div><h2>Turnos registrados</h2>
            <p>{listados.length} turnos en el listado</p></div>
          <div className="shift-list-actions">
            <button type="button" className={'button ghost small' + (filtroArea ? ' has-filter' : '')}
              aria-expanded={mostrarFiltros} aria-controls="shift-filter-options"
              onClick={() => setMostrarFiltros(v => !v)}>☷ Filtros{filtroArea ? ' · 1' : ''}</button>
          </div>
        </div>
        {mostrarFiltros && <div id="shift-filter-options" className="employee-filter-panel">
          <label>Departamento
            <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)}>
              <option value="">Todos los departamentos</option>
              {departamentos.map(d => <option key={d.id_departamento} value={d.id_departamento}>{d.nombre}</option>)}
            </select>
          </label>
          <button type="button" className="text-button" onClick={() => {setFiltroArea('');setMostrarFiltros(false);}}>Limpiar filtros</button>
        </div>}
        <div className="table-wrap shift-desktop-table"><table>
          <thead><tr><th>Departamento</th><th>Fecha y hora</th><th>Tipo</th><th>Cobertura</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {listados.map(t => <tr key={t.id_turno}>
              <td><strong>{t.departamento}</strong></td>
              <td><span className="shift-date">{textoFecha(t.inicio_at)}</span><span className="cell-sub">Hasta {textoFecha(t.fin_at)}</span></td>
              <td className="shift-capitalize">{t.tipo_turno}</td>
              <td><div className="shift-coverage"><strong>{t.cupos_ocupados} / {t.cupos_requeridos}</strong><div className="shift-bar"><span style={{width:t.cupos_requeridos > 0 ? (100*t.cupos_ocupados/t.cupos_requeridos)+'%':'0%'}}/></div></div></td>
              <td><span className={'status '+(t.estado==='abierto'?'status-green':'status-amber')}>{t.estado}</span></td>
              <td><button type="button" className="text-button" disabled={procesando} onClick={() => abrirTurno(t.id_turno)}>Detalles →</button></td>
            </tr>)}
            {!cargando && listados.length===0 && <tr><td colSpan={6} className="no-rows">No hay turnos para estos filtros.</td></tr>}
            {cargando && <tr><td colSpan={6} className="no-rows">Cargando turnos…</td></tr>}
          </tbody>
        </table></div>
        <div className="shift-mobile-list">
          {listados.map(t => <article className="shift-mobile-card" key={t.id_turno}>
            <div className="shift-mobile-heading">
              <div><span className="eyebrow">TURNO {t.id_turno}</span><h3>{t.departamento}</h3></div>
              <span className={'status '+(t.estado==='abierto'?'status-green':'status-amber')}>{t.estado}</span>
            </div>
            <div className="shift-mobile-time">
              <span className="shift-capitalize">{t.tipo_turno}</span>
              <strong>{textoFecha(t.inicio_at)}</strong>
              <small>Hasta {textoFecha(t.fin_at)}</small>
            </div>
            <div className="shift-mobile-footer">
              <div className="shift-coverage"><strong>Cobertura {t.cupos_ocupados} / {t.cupos_requeridos}</strong>
                <div className="shift-bar"><span style={{width:t.cupos_requeridos>0?(100*t.cupos_ocupados/t.cupos_requeridos)+'%':'0%'}}/></div>
              </div>
              <button className="text-button" type="button" disabled={procesando}
                onClick={() => abrirTurno(t.id_turno)}>Ver detalles →</button>
            </div>
          </article>)}
          {!cargando && listados.length===0 && <div className="employee-mobile-empty">No hay turnos para estos filtros.</div>}
          {cargando && <div className="employee-mobile-empty">Cargando turnos…</div>}
        </div>
        <div className="table-footer">Hasta 100 turnos. Coberturas calculadas por PostgreSQL.</div>
      </section>

      {detalle && <div className="overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDetalle(null);}}>
        <section className="drawer" role="dialog" aria-modal="true" aria-label="Detalle del turno">
          <div className="drawer-header"><span className="eyebrow">TURNO #{detalle.turno.id_turno}</span><button type="button" className="icon-btn" aria-label="Cerrar detalle" onClick={()=>setDetalle(null)}>✕</button></div>
          <h2>{detalle.turno.departamento}</h2>
          <p className="muted">{textoFecha(detalle.turno.inicio_at)} — {textoFecha(detalle.turno.fin_at)}</p>
          <span className={'status '+(detalle.turno.estado==='abierto'?'status-green':'status-amber')}>{detalle.turno.estado}</span>
          <div className="divider"/>
          <h3>Requerimientos de cobertura</h3>
          {detalle.requerimientos.map(req=><div className="shift-requirement" key={req.id_requerimiento}>
            <div className="shift-requirement-top"><strong>{req.cargo}</strong><span>{req.cupos_ocupados}/{req.cupos_requeridos}</span></div>
            <p>{req.especialidad||'Sin especialidad específica'} · Prioridad {req.prioridad}</p>
          </div>)}
          <div className="divider"/>
          <h3>Personal asignado</h3>
          {detalle.asignaciones.length===0 && <p className="muted">Sin asignaciones todavía.</p>}
          {detalle.asignaciones.map(a=><div className="person-line shift-person" key={a.id_asignacion}>
            <div><strong>{a.nombres} {a.apellidos}</strong><small>{a.codigo_empleado} · {a.estado}</small></div>
            {detalle.turno.estado==='abierto' && <button disabled={procesando} type="button" className="text-button" onClick={()=>cancelarAsignacion(a.id_asignacion)}>Cancelar</button>}
          </div>)}
          {detalle.turno.estado==='abierto' && r && <>
            <div className="divider"/>
            <h3>Asignar personal</h3>
            <p className="muted shift-help">Se muestran empleados activos del departamento con el cargo solicitado. La base de datos comprobará cupos, solapamientos, acreditaciones y ausencias.</p>
            <select className="shift-select" value={seleccion} onChange={e=>setSeleccion(e.target.value)}>
              <option value="">Seleccionar empleado</option>
              {candidatosCompatibles.map(e=><option key={e.id_empleado} value={e.id_empleado}>{e.nombres} {e.apellidos} ({e.codigo_empleado})</option>)}
            </select>
            <button type="button" className="button primary shift-submit" disabled={!seleccion||procesando||r.cupos_ocupados>=r.cupos_requeridos} onClick={()=>asignar(r)}>
              {procesando ? 'Procesando…' : 'Registrar asignación'}
            </button>
            {r.cupos_ocupados>=r.cupos_requeridos && <p className="muted shift-help">Todos los cupos están cubiertos.</p>}
            <div className="divider"/>
            <button type="button" className="button secondary" disabled={procesando} onClick={cancelarTurno}>Cancelar turno</button>
          </>}
          {esAdmin && <div className="shift-crud-actions">
            {detalle.turno.estado==='abierto' &&
              <button type="button" className="button ghost" disabled={procesando}
                onClick={editarTurno}>Editar turno</button>}
            <button type="button" className="button ghost dangerous" disabled={procesando}
              onClick={eliminarTurno}>Eliminar definitivamente</button>
          </div>}
          {error && <div className="alert" role="alert">! {error}</div>}
          {mensaje && <div className="shift-success" role="status">✓ {mensaje}</div>}
        </section>
      </div>}
    </div>
  );
}
