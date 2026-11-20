import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Turnos from './Turnos';
import NuevoEmpleado from './NuevoEmpleado';
import {
  ApiError, iniciarSesion, requestApi
} from './api';
import type {
  Acreditacion, Departamento, Empleado, EmpleadoDetalle, Sesion
} from './api';

type Pagina = 'resumen' | 'empleados' | 'departamentos' | 'turnos';
type Detalle = { empleado: EmpleadoDetalle; especialidades: Acreditacion[] };
type ListaDepartamento = { departamento: Departamento; empleados: Empleado[] };

function ErrorMessage({ text }: { text: string }) {
  return <div role="alert" className="alert"><span aria-hidden="true">!</span>{text}</div>;
}

function Entrada({ label, value, onChange, type = 'text', placeholder, autoComplete }:
  { label: string; value: string; onChange: (text: string) => void;
    type?: string; placeholder?: string; autoComplete?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder}
        autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}

function PantallaLogin({ onLogin }: { onLogin: (session: Sesion) => void }) {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (procesando) return;
    setProcesando(true);
    setError('');
    try {
      onLogin(await iniciarSesion(usuario, contrasena));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setProcesando(false);
    }
  }
  return (
    <div className="login-layout">
      <section className="login-brand">
        <div className="brand-lockup"><div className="brand-symbol">✚</div><span>SIGPMAT <small>/ SISTEMA HOSPITALARIO</small></span></div>
        <div className="login-message">
          <div className="eyebrow light">GESTIÓN DEL PERSONAL MÉDICO</div>
          <h1>Una operación<br />más clara.<br /><em>Un equipo mejor<br />coordinado.</em></h1>
          <p>Personal, departamentos y cobertura hospitalaria en un mismo entorno de trabajo.</p>
        </div>
        <div className="login-footnote"><span className="status-dot" /> Entorno académico de desarrollo · UES 2026</div>
      </section>
      <main className="login-form-area">
        <div className="login-box">
          <div className="mobile-brand">✚ SIGPMAT</div>
          <div className="eyebrow">ACCESO AL SISTEMA</div>
          <h2>Bienvenido de nuevo</h2>
          <p className="muted intro">Ingresa con tus credenciales asignadas para continuar.</p>
          <form onSubmit={enviar} className="login-form">
            <Entrada label="Nombre de usuario" placeholder="usuario" autoComplete="username" value={usuario} onChange={setUsuario} />
            <Entrada label="Contraseña" type="password" autoComplete="current-password" value={contrasena} onChange={setContrasena} />
            {error && <ErrorMessage text={error} />}
            <button className="button primary full" type="submit" disabled={procesando}>{procesando ? 'Validando credenciales…' : 'Ingresar al sistema'} <span aria-hidden="true">→</span></button>
          </form>
          <div className="login-help"><span className="lock-icon">⌁</span> Sesión protegida · Acceso según rol</div>
          <p className="mini muted">Los datos de esta instalación son ficticios. No debe utilizarse en operación clínica real.</p>
        </div>
      </main>
    </div>
  );
}

function Estado({ estado }: { estado: string }) {
  const good = estado.toLowerCase() === 'activo';
  return <span className={'status ' + (good ? 'status-green' : 'status-amber')}><span className="status-pip" />{estado}</span>;
}

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [pagina, setPagina] = useState<Pagina>('resumen');
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [filtrados, setFiltrados] = useState<Empleado[] | null>(null);
  const [filtro, setFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [detalleArea, setDetalleArea] = useState<ListaDepartamento | null>(null);
  const [editando, setEditando] = useState(false);
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [estadoEdicion, setEstadoEdicion] = useState<'activo'|'suspendido'|'inactivo'>('activo');
  const [guardando, setGuardando] = useState(false);
  const [mostrarNuevoEmpleado, setMostrarNuevoEmpleado] = useState(false);
  const [mensajeEmpleado, setMensajeEmpleado] = useState('');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const menuRef = useRef<HTMLElement | null>(null);
  const botonCerrarMenuRef = useRef<HTMLButtonElement | null>(null);
  const botonSalirRef = useRef<HTMLButtonElement | null>(null);
  const disparadorMenuRef = useRef<HTMLButtonElement | null>(null);
  const destinoMenuRef = useRef<'navegacion' | 'perfil'>('navegacion');

  const esAdmin = sesion?.usuario.roles.includes('ADMIN_GENERAL') ?? false;
  const esJefe = sesion?.usuario.roles.includes('JEFE_AREA') ?? false;
  const autorizado = esAdmin || esJefe;
  const token = sesion?.access_token ?? '';

  function manejarError(e: unknown) {
    if (e instanceof ApiError && e.status === 401) {
      setSesion(null);
      setDetalle(null);
      setError('');
      return;
    }
    setError(e instanceof Error ? e.message : 'Error de comunicación');
  }

  useEffect(() => {
    if (!sesion || !autorizado) return;
    let cancelar = false;
    setCargando(true);
    setError('');
    Promise.all([
      requestApi<{ departamentos: Departamento[] }>('/api/departamentos', token),
      requestApi<{ empleados: Empleado[] }>('/api/empleados', token)
    ]).then(([d, e]) => {
      if (cancelar) return;
      setDepartamentos(d.departamentos);
      setEmpleados(e.empleados);
    }).catch((e: unknown) => {
      if (!cancelar) manejarError(e);
    }).finally(() => { if (!cancelar) setCargando(false); });
    return () => { cancelar = true; };
    // La sesión y la versión son los únicos disparadores de la carga general.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, version, autorizado]);

  useEffect(() => {
    if (!sesion || !autorizado || !filtro) { setFiltrados(null); return; }
    let cancelar = false;
    requestApi<{ empleados: Empleado[] }>('/api/empleados?departamento_id=' + encodeURIComponent(filtro), token)
      .then(r => { if (!cancelar) { setFiltrados(r.empleados); setError(''); } })
      .catch(e => { if (!cancelar) manejarError(e); });
    return () => { cancelar = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, token, version, autorizado]);

  const listado = useMemo(() => {
    const needle = busqueda.trim().toLocaleLowerCase('es');
    return (filtrados ?? empleados).filter(e =>
      [e.codigo_empleado, e.nombres, e.apellidos, e.cargo].some(t => t.toLocaleLowerCase('es').includes(needle))
    );
  }, [busqueda, empleados, filtrados]);

  async function abrirEmpleado(id: string) {
    setError(''); setDetalle(null); setEditando(false); setCargando(true);
    try {
      const [e, a] = await Promise.all([
        requestApi<{ empleado: EmpleadoDetalle }>('/api/empleados/' + encodeURIComponent(id), token),
        requestApi<{ especialidades: Acreditacion[] }>('/api/empleados/' + encodeURIComponent(id) + '/especialidades', token)
      ]);
      setDetalle({ empleado: e.empleado, especialidades: a.especialidades });
      setNombres(e.empleado.nombres); setApellidos(e.empleado.apellidos);
      setEstadoEdicion(e.empleado.estado_vinculo as 'activo'|'suspendido'|'inactivo');
    } catch (e) { manejarError(e); }
    finally { setCargando(false); }
  }

  async function abrirDepartamento(id: string) {
    setDetalleArea(null); setError(''); setCargando(true);
    try { setDetalleArea(await requestApi<ListaDepartamento>('/api/departamentos/' + encodeURIComponent(id) + '/empleados', token)); }
    catch (e) { manejarError(e); }
    finally { setCargando(false); }
  }

  async function guardarEmpleado(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detalle || !esAdmin || guardando) return;
    setGuardando(true); setError('');
    try {
      await requestApi('/api/empleados/' + detalle.empleado.id_empleado, token, {
        method: 'PATCH',
        body: JSON.stringify({ nombres: nombres.trim(), apellidos: apellidos.trim(), estado_vinculo: estadoEdicion })
      });
      setEditando(false); setVersion(v => v + 1);
      await abrirEmpleado(detalle.empleado.id_empleado);
    } catch (e) { manejarError(e); }
    finally { setGuardando(false); }
  }

  function abrirMenuMovil(destino: 'navegacion' | 'perfil', boton: HTMLButtonElement) {
    destinoMenuRef.current = destino;
    disparadorMenuRef.current = boton;
    setMenuMovilAbierto(true);
  }

  // El panel móvil conserva el foco y bloquea el desplazamiento de fondo.
  useEffect(() => {
    if (!menuMovilAbierto) return;

    const desbordamientoAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const objetivo = destinoMenuRef.current === 'perfil'
      ? botonSalirRef.current
      : botonCerrarMenuRef.current;
    objetivo?.focus();

    function pulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        setMenuMovilAbierto(false);
        return;
      }
      if (evento.key !== 'Tab' || !menuRef.current) return;
      const controles = Array.from(
        menuRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      ).filter(elemento => elemento.getClientRects().length > 0);
      if (controles.length === 0) return;
      const primero = controles[0];
      const ultimo = controles[controles.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    const escritorio = window.matchMedia('(min-width: 761px)');
    const comprobarAncho = () => { if (escritorio.matches) setMenuMovilAbierto(false); };
    window.addEventListener('keydown', pulsarTecla);
    escritorio.addEventListener('change', comprobarAncho);

    return () => {
      document.body.style.overflow = desbordamientoAnterior;
      window.removeEventListener('keydown', pulsarTecla);
      escritorio.removeEventListener('change', comprobarAncho);
      if (disparadorMenuRef.current?.isConnected) disparadorMenuRef.current.focus();
    };
  }, [menuMovilAbierto]);

  function cerrarSesion() {
    setMenuMovilAbierto(false);
    setSesion(null); setDetalle(null); setDetalleArea(null);
    setMostrarNuevoEmpleado(false); setMensajeEmpleado('');
    setDepartamentos([]); setEmpleados([]); setPagina('resumen'); setFiltro(''); setBusqueda('');
  }

  if (!sesion) return <PantallaLogin onLogin={s => { setSesion(s); setPagina('resumen'); }} />;

  const iniciales = sesion.usuario.nombre_usuario.slice(0, 2).toUpperCase();
  const etiquetas: Record<Pagina, string> = { resumen: 'Panel principal', empleados: 'Personal hospitalario', departamentos: 'Departamentos', turnos: 'Turnos y cobertura' };

  return (
    <div className="app-layout">
      <button className={'mobile-menu-backdrop' + (menuMovilAbierto ? ' visible' : '')}
        type="button" aria-label="Cerrar menú de navegación" tabIndex={menuMovilAbierto ? 0 : -1}
        onClick={() => setMenuMovilAbierto(false)} />
      <aside ref={menuRef} id="sigpmat-menu" className={'sidebar' + (menuMovilAbierto ? ' sidebar-open' : '')}
        aria-label="Menú principal" role={menuMovilAbierto ? 'dialog' : undefined}
        aria-modal={menuMovilAbierto ? true : undefined}>
        <div className="sidebar-top">
          <div className="sidebar-brand-row">
            <div className="brand-lockup"><div className="brand-symbol">✚</div><span>SIGPMAT <small>GESTIÓN HOSPITALARIA</small></span></div>
            <button ref={botonCerrarMenuRef} className="mobile-menu-close" type="button"
              aria-label="Cerrar menú" onClick={() => setMenuMovilAbierto(false)}>✕</button>
          </div>
          <p className="nav-section-label">ESPACIO DE TRABAJO</p>
          <nav aria-label="Navegación principal">
            {([
              ['resumen', '◈', 'Panel principal'],
              ['empleados', '▤', 'Personal médico'],
              ['departamentos', '▦', 'Departamentos'],
              ['turnos', '◷', 'Turnos y cobertura']
            ] as const).map(([id, glyph, text]) => (
              <button key={id} type="button" className={'nav-item ' + (pagina === id ? 'nav-active' : '')} onClick={() => {setPagina(id); setDetalle(null); setDetalleArea(null); setError(''); setMenuMovilAbierto(false);}}>
                <span className="nav-glyph" aria-hidden="true">{glyph}</span>{text}
              </button>
            ))}
          </nav>
          <div className="sidebar-note"><div className="note-spark">✦</div><strong>Espacio de desarrollo</strong><p>Información ficticia para pruebas y demostración.</p></div>
        </div>
        <div className="sidebar-profile">
          <span className="profile-avatar">{iniciales}</span>
          <div className="profile-copy"><strong>{sesion.usuario.nombre_usuario}</strong><span>{esAdmin ? 'Administrador general' : esJefe ? 'Jefe de área' : 'Personal médico'}</span></div>
          <button ref={botonSalirRef} className="logout-button" type="button" onClick={cerrarSesion}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5M21 12H9" />
            </svg>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="main" inert={menuMovilAbierto}>
        <header className="topbar">
          <div className="mobile-topbar">
            <button type="button" className="mobile-header-button" aria-label="Abrir menú de navegación"
              aria-controls="sigpmat-menu" aria-expanded={menuMovilAbierto}
              onClick={evento => abrirMenuMovil('navegacion', evento.currentTarget)}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="mobile-page-identity">
              <span>SIGPMAT</span>
              <h1>{etiquetas[pagina]}</h1>
            </div>
            <button type="button" className="mobile-header-button" aria-label="Actualizar datos"
              onClick={() => setVersion(v => v + 1)} disabled={cargando}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M20 7v5h-5M4 17v-5h5" />
                <path d="M5.5 9a7 7 0 0 1 12-2l2.5 5M18.5 15a7 7 0 0 1-12 2L4 12" />
              </svg>
            </button>
            <button type="button" className="mobile-profile-trigger" aria-label="Abrir perfil de usuario"
              aria-controls="sigpmat-menu" aria-expanded={menuMovilAbierto}
              onClick={evento => abrirMenuMovil('perfil', evento.currentTarget)}>
              {iniciales}
            </button>
          </div>
          <div className="breadcrumbs">SIGPMAT <span>/</span> {etiquetas[pagina]}</div>
          <div className="top-actions"><span className="live-dot" /><span className="top-status">Entorno local</span><button type="button" className="button ghost small" onClick={() => setVersion(v => v + 1)} disabled={cargando}>↻ Actualizar</button></div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><div className="eyebrow">ADMINISTRACIÓN OPERATIVA</div><h1>{etiquetas[pagina]}</h1>
              <p>{pagina === 'resumen' ? 'Una vista clara de la información disponible para tu perfil.' : pagina === 'empleados' ? 'Consulta y administra la información del personal autorizado.' : pagina === 'turnos' ? 'Programa turnos y asigna personal según la cobertura necesaria.' : 'Consulta las áreas hospitalarias disponibles según tu rol.'}</p></div>
            <div className="date-pill">◷ <span>Datos consultados en PostgreSQL</span></div>
          </div>

          {error && <ErrorMessage text={error} />}
          {!autorizado ? <div className="empty"><h2>Acceso limitado</h2><p>Este perfil no cuenta todavía con módulos de consulta habilitados. La API mantiene sus permisos de acceso.</p></div> :
          pagina === 'resumen' ? (
            <>
              <div className="metrics">
                <div className="metric-card"><span className="metric-icon m1">▦</span><span className="metric-label">Departamentos visibles</span><strong>{departamentos.length}</strong><small>Según los permisos de la cuenta</small></div>
                <div className="metric-card"><span className="metric-icon m2">▤</span><span className="metric-label">Empleados visibles</span><strong>{empleados.length}</strong><small>Hasta 100 registros por consulta</small></div>
                <div className="metric-card"><span className="metric-icon m3">✓</span><span className="metric-label">Personal activo</span><strong>{empleados.filter(e => e.estado_vinculo === 'activo').length}</strong><small>Dentro del listado autorizado</small></div>
                <div className="metric-card"><span className="metric-icon m4">◷</span><span className="metric-label">Otros estados</span><strong>{empleados.filter(e => e.estado_vinculo !== 'activo').length}</strong><small>Suspendidos o inactivos</small></div>
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading"><div><div className="eyebrow">OPERACIÓN</div><h2>Personal reciente en el listado</h2></div><button type="button" className="text-button" onClick={() => setPagina('empleados')}>Ver personal →</button></div>
                  <div className="table-wrap"><table><thead><tr><th>Empleado</th><th>Cargo</th><th>Estado</th></tr></thead><tbody>{empleados.slice(0, 6).map(e => <tr key={e.id_empleado}><td><strong>{e.nombres} {e.apellidos}</strong><span className="cell-sub">{e.codigo_empleado}</span></td><td>{e.cargo}</td><td><Estado estado={e.estado_vinculo}/></td></tr>)}{empleados.length === 0 && <tr><td colSpan={3} className="no-rows">Sin empleados visibles</td></tr>}</tbody></table></div>
                </section>
                <section className="panel operations">
                  <div className="eyebrow">ACCESOS RÁPIDOS</div><h2>Continuar trabajando</h2>
                  <button type="button" className="quick-link" onClick={() => setPagina('empleados')}><span className="quick-icon">▤</span><span><strong>Consultar personal</strong><small>Datos y acreditaciones</small></span><span>→</span></button>
                  <button type="button" className="quick-link" onClick={() => setPagina('departamentos')}><span className="quick-icon">▦</span><span><strong>Explorar departamentos</strong><small>Áreas y personal adscrito</small></span><span>→</span></button>
                  <button type="button" className="quick-link" onClick={() => setPagina('turnos')}><span className="quick-icon">◷</span><span><strong>Planificar turnos</strong><small>Cupos y asignaciones</small></span><span>→</span></button>
                  <div className="notice"><strong>En desarrollo</strong><p>La asignación automática y los reportes avanzados todavía no están disponibles.</p></div>
                </section>
              </div>
            </>
          ) : pagina === 'empleados' ? (
            <section className="panel">
              <div className="panel-heading wrap-heading"><div><div className="eyebrow">DIRECTORIO</div><h2>Empleados autorizados</h2><p>{listado.length} resultados visibles {cargando ? '· Actualizando…' : ''}</p>{mensajeEmpleado && <p role="status" className="employee-success">{mensajeEmpleado}</p>}</div>
                <div className="filters">{esAdmin && <button type="button" className="button primary small" onClick={() => { setMensajeEmpleado(''); setMostrarNuevoEmpleado(true); }}>+ Registrar empleado</button>}<input aria-label="Buscar empleados" value={busqueda} placeholder="Buscar nombre, código o cargo…" onChange={e => setBusqueda(e.target.value)}/><select aria-label="Filtrar por departamento" value={filtro} onChange={e => setFiltro(e.target.value)}><option value="">Todos los departamentos permitidos</option>{departamentos.map(d => <option key={d.id_departamento} value={d.id_departamento}>{d.nombre}</option>)}</select></div>
              </div>
              <div className="table-wrap"><table><thead><tr><th>Código</th><th>Nombre completo</th><th>Cargo</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
                {listado.map(e => <tr key={e.id_empleado}><td className="mono">{e.codigo_empleado}</td><td><strong>{e.nombres} {e.apellidos}</strong></td><td>{e.cargo}</td><td><Estado estado={e.estado_vinculo}/></td><td><button type="button" className="text-button" onClick={() => abrirEmpleado(e.id_empleado)}>Ver detalle →</button></td></tr>)}
                {listado.length === 0 && <tr><td colSpan={5} className="no-rows">No hay empleados que coincidan con los filtros.</td></tr>}
              </tbody></table></div>
              <div className="table-footer">Se muestran como máximo 100 registros por consulta. No se presentan datos personales sensibles.</div>
            </section>
          ) : pagina === 'turnos' ? (
            <Turnos token={token} departamentos={departamentos} onSesionExpirada={cerrarSesion} />
          ) : (
            <div className="departments-grid">
              {departamentos.map(d => <article className="department-card" key={d.id_departamento}><div className="dept-symbol">✚</div><div className="eyebrow">{d.codigo}</div><h2>{d.nombre}</h2><p>Área hospitalaria autorizada para este perfil.</p><button type="button" className="button secondary" onClick={() => abrirDepartamento(d.id_departamento)}>Ver personal adscrito <span>→</span></button></article>)}
              {departamentos.length === 0 && <div className="empty">No hay departamentos disponibles para este usuario.</div>}
            </div>
          )}
          <footer className="footer">SIGPMAT · Universidad de El Salvador · Proyecto académico 2026 <span>v0.3 — Interfaz web</span></footer>
        </div>
      </main>

      {esAdmin && mostrarNuevoEmpleado && <NuevoEmpleado token={token} departamentos={departamentos} onCerrar={() => setMostrarNuevoEmpleado(false)} onSesionExpirada={cerrarSesion} onGuardado={(codigo) => { setMostrarNuevoEmpleado(false); setFiltro(''); setBusqueda(''); setVersion(v => v + 1); setMensajeEmpleado('Empleado ' + codigo + ' registrado correctamente.'); }} />}

      {(detalle || detalleArea) && <div className="overlay" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) {setDetalle(null);setDetalleArea(null);} }}>
        <section role="dialog" aria-modal="true" aria-label={detalle ? 'Detalle del empleado' : 'Detalle del departamento'} className="drawer">
          <div className="drawer-header"><span className="eyebrow">DETALLE DE REGISTRO</span><button type="button" className="icon-btn" aria-label="Cerrar detalle" onClick={() => {setDetalle(null);setDetalleArea(null);}}>✕</button></div>
          {detalle ? <>
            <div className="drawer-title"><div className="big-avatar">{detalle.empleado.nombres.charAt(0)}{detalle.empleado.apellidos.charAt(0)}</div><div><h2>{detalle.empleado.nombres} {detalle.empleado.apellidos}</h2><p>{detalle.empleado.codigo_empleado}</p></div></div>
            <dl className="detail-grid"><div><dt>Cargo</dt><dd>{detalle.empleado.cargo}</dd></div><div><dt>Estado</dt><dd><Estado estado={detalle.empleado.estado_vinculo}/></dd></div><div><dt>Fecha de ingreso</dt><dd>{detalle.empleado.fecha_ingreso || 'No registrada'}</dd></div><div><dt>Departamento(s)</dt><dd>{detalle.empleado.departamentos?.map(d => d.nombre).join(', ') || 'Sin adscripción vigente'}</dd></div></dl>
            <div className="divider"/>
            <h3>Especialidades acreditadas</h3>
            {detalle.especialidades.length ? <div className="specialties">{detalle.especialidades.map(a => <div key={a.id_empleado_especialidad} className="specialty"><strong>{a.nombre}</strong><span>{a.codigo} · Desde {a.vigente_desde}{a.vigente_hasta ? ' hasta ' + a.vigente_hasta : ''}</span></div>)}</div> : <p className="muted">Sin acreditaciones registradas.</p>}
            {esAdmin && <><div className="divider"/><button type="button" className="button secondary" onClick={() => setEditando(!editando)}>{editando ? 'Cancelar edición' : 'Editar datos y estado'}</button>
              {editando && <form onSubmit={guardarEmpleado} className="edit-form"><Entrada label="Nombres" value={nombres} onChange={setNombres}/><Entrada label="Apellidos" value={apellidos} onChange={setApellidos}/><label className="field"><span>Estado laboral</span><select value={estadoEdicion} onChange={e => setEstadoEdicion(e.target.value as 'activo'|'suspendido'|'inactivo')}><option value="activo">Activo</option><option value="suspendido">Suspendido</option><option value="inactivo">Inactivo</option></select></label><p className="edit-note">No se puede suspender a un empleado con cuenta vinculada ni con asignaciones activas.</p><button className="button primary" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button></form>}</>}
          </> : detalleArea ? <>
            <div className="drawer-title"><div className="big-avatar">✚</div><div><h2>{detalleArea.departamento.nombre}</h2><p>{detalleArea.departamento.codigo}</p></div></div>
            <h3>Personal adscrito actualmente</h3>
            <div className="dept-people">{detalleArea.empleados.map(e => <div className="person-line" key={e.id_empleado}><strong>{e.nombres} {e.apellidos}</strong><small>{e.codigo_empleado}</small></div>)}{detalleArea.empleados.length === 0 && <p className="muted">No hay personal activo adscrito.</p>}</div>
          </> : null}
        </section>
      </div>}
    </div>
  );
}
