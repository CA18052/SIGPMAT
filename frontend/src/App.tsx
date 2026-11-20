import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Turnos from './Turnos';
import NuevoEmpleado from './NuevoEmpleado';
import FormularioDepartamento from './FormularioDepartamento';
import AvatarEmpleado from './AvatarEmpleado';
import Usuarios from './Usuarios';
import CambiarContrasena from './CambiarContrasena';
import {
  actualizarUsuarioDeSesion, borrarSesionDePestana, guardarPaginaEnPestana,
  guardarSesionEnPestana, recuperarPaginaDePestana, recuperarSesionDePestana
} from './session';
import {
  ApiError, iniciarSesion, requestApi
} from './api';
import type {
  Acreditacion, Departamento, Empleado, EmpleadoDetalle, Sesion, Usuario
} from './api';

type Pagina = 'resumen' | 'empleados' | 'departamentos' | 'turnos' | 'usuarios';
type Detalle = { empleado: EmpleadoDetalle; especialidades: Acreditacion[] };
type ListaDepartamento = { departamento: Departamento; empleados: Empleado[] };

function ErrorMessage({ text, motivo, solucion }: {
  text: string; motivo?: string; solucion?: string
}) {
  return <div role="alert" className="alert crud-error-detail">
    <strong>{text}</strong>
    {motivo && <p><b>¿Por qué?</b> {motivo}</p>}
    {solucion && <p><b>¿Cómo solucionarlo?</b> {solucion}</p>}
  </div>;
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
        <div className="login-footnote"><span className="status-dot" /> Universidad de El Salvador</div>
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
          <p className="mini muted">¿Necesitas una cuenta? Solicita tus credenciales al superadministrador. El registro administrativo no es público.</p>
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
  const [sesion, setSesion] = useState<Sesion | null>(recuperarSesionDePestana);
  const [validandoSesion, setValidandoSesion] = useState(() => recuperarSesionDePestana() !== null);
  const [pagina, setPagina] = useState<Pagina>(recuperarPaginaDePestana);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [filtrados, setFiltrados] = useState<Empleado[] | null>(null);
  const [filtro, setFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [errorDetalle, setErrorDetalle] = useState<{ motivo?: string; solucion?: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [detalleArea, setDetalleArea] = useState<ListaDepartamento | null>(null);
  const [editando, setEditando] = useState(false);
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [estadoEdicion, setEstadoEdicion] = useState<'activo'|'suspendido'|'inactivo'>('activo');
  const [duiEdicion, setDuiEdicion] = useState('');
  const [telefonoEdicion, setTelefonoEdicion] = useState('');
  const [correoEdicion, setCorreoEdicion] = useState('');
  const [registroEdicion, setRegistroEdicion] = useState('');
  const [ingresoEdicion, setIngresoEdicion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mostrarNuevoEmpleado, setMostrarNuevoEmpleado] = useState(false);
  const [mensajeEmpleado, setMensajeEmpleado] = useState('');
  const [formularioDepartamento, setFormularioDepartamento] = useState<Departamento | 'nuevo' | null>(null);
  const [mensajeDepartamento, setMensajeDepartamento] = useState('');
  const [mostrarCambioClave, setMostrarCambioClave] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const menuRef = useRef<HTMLElement | null>(null);
  const botonCerrarMenuRef = useRef<HTMLButtonElement | null>(null);
  const botonSalirRef = useRef<HTMLButtonElement | null>(null);
  const disparadorMenuRef = useRef<HTMLButtonElement | null>(null);
  const destinoMenuRef = useRef<'navegacion' | 'perfil'>('navegacion');

  // Validación al recuperar una sesión: nunca confiar sólo en sessionStorage.
  // Fastify consulta la cuenta y los roles vigentes antes de permitir operaciones.
  useEffect(() => {
    const guardada = recuperarSesionDePestana();
    if (!guardada) { setValidandoSesion(false); return; }
    let cancelado = false;
    requestApi<{ usuario: Usuario }>('/api/auth/me', guardada.access_token)
      .then(({ usuario }) => {
        if (cancelado) return;
        if (usuario.id_usuario !== guardada.usuario.id_usuario) {
          borrarSesionDePestana();
          setSesion(null);
          return;
        }
        actualizarUsuarioDeSesion(usuario);
        setSesion({ ...guardada, usuario });
      })
      .catch(e => {
        if (cancelado) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          borrarSesionDePestana();
          setSesion(null);
        }
        // Si Render está despertando o no hay red, conservar el token válido.
        // Las consultas protegidas mostrarán su error sin inventar una sesión nueva.
      })
      .finally(() => { if (!cancelado) setValidandoSesion(false); });
    return () => { cancelado = true; };
  }, []);

  // Mantener la sección actual de la pestaña al recargar con el navegador.
  useEffect(() => {
    if (sesion && !validandoSesion) guardarPaginaEnPestana(pagina);
  }, [sesion, pagina, validandoSesion]);

  const esAdmin = sesion?.usuario.roles.includes('ADMIN_GENERAL') ?? false;
  const esSuperadmin = sesion?.usuario.es_superadministrador === true;
  const esJefe = sesion?.usuario.roles.includes('JEFE_AREA') ?? false;
  const autorizado = esAdmin || esJefe;
  const token = sesion?.access_token ?? '';

  useEffect(() => {
    if (pagina === 'usuarios' && !esSuperadmin) setPagina('resumen');
  }, [pagina, esSuperadmin]);

  function manejarError(e: unknown) {
    if (e instanceof ApiError && e.status === 401) {
      cerrarSesion();
      return;
    }
    setErrorDetalle(e instanceof ApiError
      ? { motivo: e.motivo, solucion: e.solucion } : null);
    setError(e instanceof Error ? e.message : 'Error de comunicación');
  }

  useEffect(() => {
    if (!error) setErrorDetalle(null);
  }, [error]);

  useEffect(() => {
    if (!sesion || !autorizado || validandoSesion || sesion.usuario.debe_cambiar_contrasena) return;
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
  }, [token, version, autorizado, validandoSesion]);

  useEffect(() => {
    if (!sesion || !autorizado || validandoSesion || sesion.usuario.debe_cambiar_contrasena || !filtro) { setFiltrados(null); return; }
    let cancelar = false;
    requestApi<{ empleados: Empleado[] }>('/api/empleados?departamento_id=' + encodeURIComponent(filtro), token)
      .then(r => { if (!cancelar) { setFiltrados(r.empleados); setError(''); } })
      .catch(e => { if (!cancelar) manejarError(e); });
    return () => { cancelar = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, token, version, autorizado, validandoSesion]);

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
      setDuiEdicion(e.empleado.dui||'');
      setTelefonoEdicion(e.empleado.telefono||'');
      setCorreoEdicion(e.empleado.correo_contacto||'');
      setRegistroEdicion(e.empleado.numero_registro_profesional||'');
      setIngresoEdicion(e.empleado.fecha_ingreso||'');
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
        body: JSON.stringify({
          nombres:nombres.trim(),apellidos:apellidos.trim(),estado_vinculo:estadoEdicion,
          dui:duiEdicion||null,telefono:telefonoEdicion||null,
          correo_contacto:correoEdicion.trim()||null,
          numero_registro_profesional:registroEdicion.trim()||null,
          fecha_ingreso:ingresoEdicion||null
        })
      });
      setEditando(false); setVersion(v => v + 1);
      await abrirEmpleado(detalle.empleado.id_empleado);
    } catch (e) { manejarError(e); }
    finally { setGuardando(false); }
  }


  async function eliminarEmpleado() {
    if (!detalle || !esAdmin || guardando) return;
    const e = detalle.empleado;
    if (!window.confirm('¿Eliminar definitivamente a ' + e.nombres + ' ' + e.apellidos +
      '? Solo se permite sin historial. Esta acción no puede deshacerse.')) return;
    setGuardando(true); setError('');
    try {
      await requestApi('/api/empleados/' + encodeURIComponent(e.id_empleado), token, {method:'DELETE'});
      setDetalle(null); setVersion(v => v + 1);
      setMensajeEmpleado('Empleado ' + e.codigo_empleado + ' eliminado correctamente.');
    } catch (e) { manejarError(e); }
    finally { setGuardando(false); }
  }

  async function eliminarDepartamento(departamento: Departamento) {
    if (!esAdmin || guardando) return;
    if (!window.confirm('¿Eliminar definitivamente «' + departamento.nombre +
      '»? Solo es posible sin empleados ni turnos relacionados.')) return;
    setGuardando(true); setError('');
    try {
      await requestApi('/api/departamentos/' + encodeURIComponent(departamento.id_departamento),
        token, {method:'DELETE'});
      setDetalleArea(null); setVersion(v => v + 1);
      setMensajeDepartamento('Departamento ' + departamento.nombre + ' eliminado.');
    } catch (e) { manejarError(e); }
    finally { setGuardando(false); }
  }

  async function desactivarDepartamento(departamento: Departamento) {
    if (!esAdmin || guardando) return;
    if (!window.confirm('¿Desactivar «' + departamento.nombre +
      '»? No debe tener turnos abiertos futuros.')) return;
    setGuardando(true); setError('');
    try {
      await requestApi('/api/departamentos/' + encodeURIComponent(departamento.id_departamento),
        token, {method:'PATCH',body:JSON.stringify({activo:false})});
      setDetalleArea(null); setVersion(v => v + 1);
      setMensajeDepartamento('Departamento ' + departamento.nombre + ' desactivado.');
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
    borrarSesionDePestana();
    setMenuMovilAbierto(false);
    setSesion(null); setDetalle(null); setDetalleArea(null);
    setMostrarNuevoEmpleado(false); setMensajeEmpleado(''); setMostrarCambioClave(false);
    setDepartamentos([]); setEmpleados([]); setPagina('resumen'); setFiltro(''); setBusqueda('');
  }

  if (validandoSesion) return (
    <div className="session-validation" role="status" aria-live="polite">
      <div className="session-validation-mark" aria-hidden="true">✚</div>
      <strong>SIGPMAT</strong>
      <span>Verificando tu sesión segura…</span>
    </div>
  );

  if (!sesion) return <PantallaLogin onLogin={s => {
    guardarSesionEnPestana(s);
    setSesion(s);
    setPagina('resumen');
  }} />;

  if (sesion.usuario.debe_cambiar_contrasena) {
    return <CambiarContrasena token={sesion.access_token} obligatorio
      onCerrar={cerrarSesion} onCompletado={cerrarSesion}
      onSesionExpirada={cerrarSesion}/>;
  }

  const iniciales = sesion.usuario.nombre_usuario.slice(0, 2).toUpperCase();
  const etiquetas: Record<Pagina, string> = {
    resumen:'Panel principal',empleados:'Personal hospitalario',
    departamentos:'Departamentos',turnos:'Turnos y cobertura',
    usuarios:'Administración de usuarios'
  };

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
              ['turnos', '◷', 'Turnos y cobertura'],
              ...(esSuperadmin ? [['usuarios', '♙', 'Usuarios'] as const] : [])
            ] as const).map(([id, glyph, text]) => (
              <button key={id} type="button" className={'nav-item ' + (pagina === id ? 'nav-active' : '')} onClick={() => {setPagina(id); setDetalle(null); setDetalleArea(null); setError(''); setMenuMovilAbierto(false);}}>
                <span className="nav-glyph" aria-hidden="true">{glyph}</span>{text}
              </button>
            ))}
          </nav>
          <div className="sidebar-note"><div className="note-spark" aria-hidden="true">✦</div><strong>Acceso por roles</strong><p>Consulta y administra exclusivamente la información autorizada para tu cuenta.</p></div>
        </div>
        <div className="sidebar-profile">
          <span className="profile-avatar">{iniciales}</span>
          <div className="profile-copy">
            <strong>{sesion.usuario.nombre_mostrado || sesion.usuario.nombre_usuario}</strong>
            <span>{esSuperadmin?'Superadministrador':sesion.usuario.tipo_cuenta==='docente'?'Docente evaluador':esAdmin?'Administrador operativo':esJefe?'Jefe de área':'Personal médico'}</span>
          </div>
          <button type="button" className="logout-button profile-security-button"
            onClick={() => {setMostrarCambioClave(true);setMenuMovilAbierto(false);}}>
            <span aria-hidden="true">◈</span><span>Cambiar mi contraseña</span>
          </button>
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
            <button type="button" className="mobile-profile-trigger" aria-label="Abrir perfil de usuario"
              aria-controls="sigpmat-menu" aria-expanded={menuMovilAbierto}
              onClick={evento => abrirMenuMovil('perfil', evento.currentTarget)}>
              {iniciales}
            </button>
          </div>
          <div className="breadcrumbs">SIGPMAT <span>/</span> {etiquetas[pagina]}</div>
          <div className="top-actions"><span className="live-dot" /><span className="top-status">Conectado a SIGPMAT</span></div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><div className="eyebrow">ADMINISTRACIÓN OPERATIVA</div><h1>{etiquetas[pagina]}</h1>
              <p>{pagina === 'resumen' ? 'Una vista clara de la información disponible para tu perfil.' : pagina === 'empleados' ? 'Consulta y administra la información del personal autorizado.' : pagina === 'turnos' ? 'Programa turnos y asigna personal según la cobertura necesaria.' : pagina === 'usuarios' ? 'Administra las cuentas individuales y sus credenciales de forma segura.' : 'Consulta las áreas hospitalarias disponibles según tu rol.'}</p></div>
            <div className="date-pill">◷ <span>Información según tu perfil</span></div>
          </div>

          {error && <ErrorMessage text={error}
            motivo={errorDetalle?.motivo} solucion={errorDetalle?.solucion}/>}
          {!autorizado ? <div className="empty"><h2>Acceso limitado</h2><p>Este perfil no cuenta todavía con módulos de consulta habilitados. La API mantiene sus permisos de acceso.</p></div> :
          pagina === 'usuarios' ? (
            esSuperadmin
              ? <Usuarios token={token} onSesionExpirada={cerrarSesion}/>
              : <div className="empty"><h2>Acceso restringido</h2><p>La gestión de cuentas requiere permiso de superadministrador.</p></div>
          ) : pagina === 'resumen' ? (
            <>
              <div className="metrics">
                <div className="metric-card"><span className="metric-icon m1">▦</span><span className="metric-label">Departamentos visibles</span><strong>{departamentos.length}</strong><small>Según los permisos de la cuenta</small></div>
                <div className="metric-card"><span className="metric-icon m2">▤</span><span className="metric-label">Empleados visibles</span><strong>{empleados.length}</strong><small>En la consulta actual</small></div>
                <div className="metric-card"><span className="metric-icon m3">✓</span><span className="metric-label">Personal activo</span><strong>{empleados.filter(e => e.estado_vinculo === 'activo').length}</strong><small>Dentro del listado autorizado</small></div>
                <div className="metric-card"><span className="metric-icon m4">◷</span><span className="metric-label">Otros estados</span><strong>{empleados.filter(e => e.estado_vinculo !== 'activo').length}</strong><small>Suspendidos o inactivos</small></div>
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading"><div><div className="eyebrow">OPERACIÓN</div><h2>Personal reciente en el listado</h2></div><button type="button" className="text-button" onClick={() => setPagina('empleados')}>Ver personal →</button></div>
                  <div className="table-wrap"><table><thead><tr><th>Empleado</th><th>Cargo</th><th>Estado</th></tr></thead><tbody>{empleados.slice(0, 6).map(e => <tr key={e.id_empleado}><td><div className="employee-name-cell"><AvatarEmpleado empleado={e}/><div><strong>{e.nombres} {e.apellidos}</strong><span className="cell-sub">{e.codigo_empleado}</span></div></div></td><td>{e.cargo}</td><td><Estado estado={e.estado_vinculo}/></td></tr>)}{empleados.length === 0 && <tr><td colSpan={3} className="no-rows">Sin empleados visibles</td></tr>}</tbody></table></div>
                </section>
                <section className="panel operations">
                  <div className="eyebrow">ACCESOS RÁPIDOS</div><h2>Continuar trabajando</h2>
                  <button type="button" className="quick-link" onClick={() => setPagina('empleados')}><span className="quick-icon">▤</span><span><strong>Consultar personal</strong><small>Datos y acreditaciones</small></span><span>→</span></button>
                  <button type="button" className="quick-link" onClick={() => setPagina('departamentos')}><span className="quick-icon">▦</span><span><strong>Explorar departamentos</strong><small>Áreas y personal adscrito</small></span><span>→</span></button>
                  <button type="button" className="quick-link" onClick={() => setPagina('turnos')}><span className="quick-icon">◷</span><span><strong>Planificar turnos</strong><small>Cupos y asignaciones</small></span><span>→</span></button>
                </section>
              </div>
            </>
          ) : pagina === 'empleados' ? (
            <section className="panel employee-directory">
              <div className="panel-heading wrap-heading">
                <div>
                  <div className="eyebrow">DIRECTORIO</div>
                  <h2>Personal hospitalario</h2>
                  <p>{listado.length} resultados visibles {cargando ? '· Actualizando…' : ''}</p>
                  {mensajeEmpleado && <p role="status" className="employee-success">{mensajeEmpleado}</p>}
                </div>
                <div className="employee-toolbar">
                  <label className="employee-search">
                    <span className="sr-only">Buscar empleados</span>
                    <input type="search" value={busqueda} placeholder="Nombre, código o cargo…"
                      onChange={e => setBusqueda(e.target.value)} />
                  </label>
                  <button className={'button ghost small employee-filter-toggle' + (filtro ? ' has-filter' : '')}
                    type="button" aria-expanded={mostrarFiltros} aria-controls="employee-filter-options"
                    onClick={() => setMostrarFiltros(v => !v)}>☷ Filtros{filtro ? ' · 1' : ''}</button>
                  {esAdmin && <button type="button" className="button primary small employee-create-button"
                    onClick={() => {setMensajeEmpleado('');setMostrarNuevoEmpleado(true);}}>+ Registrar empleado</button>}
                </div>
              </div>
              {mostrarFiltros && <div id="employee-filter-options" className="employee-filter-panel">
                <label>Departamento
                  <select value={filtro} onChange={e => setFiltro(e.target.value)}>
                    <option value="">Todos los departamentos permitidos</option>
                    {departamentos.map(d => <option key={d.id_departamento} value={d.id_departamento}>{d.nombre}</option>)}
                  </select>
                </label>
                <button type="button" className="text-button" onClick={() => {setFiltro('');setMostrarFiltros(false);}}>Limpiar filtros</button>
              </div>}
              <div className="table-wrap employee-desktop-table"><table>
                <thead><tr><th>Código</th><th>Nombre completo</th><th>Cargo</th><th>Estado</th><th>Acción</th></tr></thead>
                <tbody>
                  {listado.map(e => <tr key={e.id_empleado}>
                    <td className="mono">{e.codigo_empleado}</td>
                    <td><div className="employee-name-cell"><AvatarEmpleado empleado={e}/><strong>{e.nombres} {e.apellidos}</strong></div></td>
                    <td>{e.cargo}</td><td><Estado estado={e.estado_vinculo}/></td>
                    <td><button type="button" className="text-button" onClick={() => abrirEmpleado(e.id_empleado)}>Ver detalle →</button></td>
                  </tr>)}
                  {listado.length === 0 && <tr><td colSpan={5} className="no-rows">No hay empleados que coincidan con los filtros.</td></tr>}
                </tbody>
              </table></div>
              <div className="mobile-employee-list">
                {listado.map(e => <article className="employee-mobile-card" key={e.id_empleado}>
                  <AvatarEmpleado empleado={e}/>
                  <div className="employee-mobile-main">
                    <strong>{e.nombres} {e.apellidos}</strong>
                    <span className="employee-mobile-code">{e.codigo_empleado}</span>
                    <span className="employee-mobile-role">{e.cargo}</span>
                    <div className="employee-mobile-bottom">
                      <Estado estado={e.estado_vinculo}/>
                      <button type="button" className="text-button" onClick={() => abrirEmpleado(e.id_empleado)}>
                        Ver detalle <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>
                </article>)}
                {listado.length === 0 && <div className="employee-mobile-empty">No hay empleados que coincidan con tu búsqueda.</div>}
              </div>
            </section>
          ) : pagina === 'turnos' ? (
            <Turnos token={token} departamentos={departamentos} esAdmin={esAdmin} onSesionExpirada={cerrarSesion} />
          ) : (
            <div className="department-section">
              <div className="department-section-header">
                <div><span className="eyebrow">ÁREAS HOSPITALARIAS</span><h2>Departamentos</h2>
                  <p>{departamentos.length} departamentos visibles</p></div>
                {esAdmin && <button className="button primary" type="button"
                  onClick={() => {setError('');setFormularioDepartamento('nuevo');}}>+ Registrar departamento</button>}
              </div>
              {mensajeDepartamento && <p role="status" className="employee-success">{mensajeDepartamento}</p>}
              <div className="departments-grid">
                {departamentos.map(d => <article className="department-card department-card-detailed" key={d.id_departamento}>
                  <div className="dept-card-top"><div className="dept-symbol">✚</div><span className="eyebrow">{d.codigo}</span></div>
                  <h2>{d.nombre}</h2><p className="dept-location">{d.ubicacion || 'Ubicación no definida'}</p>
                  <div className="dept-staff-count"><strong>{d.empleados_activos ?? '—'}</strong><span>empleados activos</span></div>
                  <button type="button" className="button secondary" onClick={() => abrirDepartamento(d.id_departamento)}>
                    Consultar personal <span aria-hidden="true">→</span>
                  </button>
                  {esAdmin && <div className="dept-management-buttons">
                    <button type="button" className="button ghost small"
                      onClick={() => {setError('');setFormularioDepartamento(d);}}>Editar</button>
                    <button type="button" className="button ghost small" disabled={guardando}
                      onClick={() => desactivarDepartamento(d)}>Desactivar</button>
                    <button type="button" className="button ghost small dangerous" disabled={guardando}
                      onClick={() => eliminarDepartamento(d)}>Eliminar</button>
                  </div>}
                </article>)}
                {departamentos.length === 0 && <div className="empty">No hay departamentos disponibles para este usuario.</div>}
              </div>
            </div>
          )}
          <footer className="footer" aria-label="Institución académica">SIGMA · Universidad de El Salvador</footer>
        </div>
      </main>

      {mostrarCambioClave && <CambiarContrasena token={token} obligatorio={false}
        onCerrar={() => setMostrarCambioClave(false)}
        onCompletado={cerrarSesion} onSesionExpirada={cerrarSesion}/>}
      {esAdmin && formularioDepartamento !== null && <FormularioDepartamento
        token={token} departamento={formularioDepartamento === 'nuevo' ? null : formularioDepartamento}
        onCerrar={() => setFormularioDepartamento(null)}
        onSesionExpirada={cerrarSesion}
        onGuardado={() => {
          const accion = formularioDepartamento === 'nuevo' ? 'registrado' : 'actualizado';
          setFormularioDepartamento(null); setVersion(v => v + 1);
          setMensajeDepartamento('Departamento ' + accion + ' correctamente.');
        }}/>
      }
      {esAdmin && mostrarNuevoEmpleado && <NuevoEmpleado token={token} departamentos={departamentos} onCerrar={() => setMostrarNuevoEmpleado(false)} onSesionExpirada={cerrarSesion} onGuardado={(codigo) => { setMostrarNuevoEmpleado(false); setFiltro(''); setBusqueda(''); setVersion(v => v + 1); setMensajeEmpleado('Empleado ' + codigo + ' registrado correctamente.'); }} />}

      {(detalle || detalleArea) && <div className="overlay" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) {setDetalle(null);setDetalleArea(null);} }}>
        <section role="dialog" aria-modal="true" aria-label={detalle ? 'Detalle del empleado' : 'Detalle del departamento'} className="drawer">
          {error && <ErrorMessage text={error}
            motivo={errorDetalle?.motivo} solucion={errorDetalle?.solucion}/>}
          <div className="drawer-header"><span className="eyebrow">DETALLE DE REGISTRO</span><button type="button" className="icon-btn" aria-label="Cerrar detalle" onClick={() => {setDetalle(null);setDetalleArea(null);}}>✕</button></div>
          {detalle ? <>
            <div className="drawer-title"><AvatarEmpleado empleado={detalle.empleado} size="grande"/><div><h2>{detalle.empleado.nombres} {detalle.empleado.apellidos}</h2><p>{detalle.empleado.codigo_empleado}</p></div></div>
            <dl className="detail-grid"><div><dt>Cargo</dt><dd>{detalle.empleado.cargo}</dd></div>
                <div><dt>Estado</dt><dd><Estado estado={detalle.empleado.estado_vinculo}/></dd></div>
                <div><dt>Fecha de ingreso</dt><dd>{detalle.empleado.fecha_ingreso || 'No registrada'}</dd></div>
                <div><dt>Departamento(s)</dt><dd>{detalle.empleado.departamentos?.map(d => d.nombre).join(', ') || 'Sin adscripción vigente'}</dd></div>
                {esAdmin && <>
                  <div><dt>DUI (ficticio en demo)</dt><dd>{detalle.empleado.dui || 'No registrado'}</dd></div>
                  <div><dt>Teléfono</dt><dd>{detalle.empleado.telefono || 'No registrado'}</dd></div>
                  <div><dt>Correo de contacto</dt><dd>{detalle.empleado.correo_contacto || 'No registrado'}</dd></div>
                  <div><dt>Registro profesional</dt><dd>{detalle.empleado.numero_registro_profesional || 'No registrado'}</dd></div>
                </>}
              </dl>
            <div className="divider"/>
            <h3>Especialidades acreditadas</h3>
            {detalle.especialidades.length ? <div className="specialties">{detalle.especialidades.map(a => <div key={a.id_empleado_especialidad} className="specialty"><strong>{a.nombre}</strong><span>{a.codigo} · Desde {a.vigente_desde}{a.vigente_hasta ? ' hasta ' + a.vigente_hasta : ''}</span></div>)}</div> : <p className="muted">Sin acreditaciones registradas.</p>}
            {esAdmin && <><div className="divider"/><button type="button" className="button secondary" onClick={() => setEditando(!editando)}>{editando ? 'Cancelar edición' : 'Editar datos y estado'}</button>
              {editando && <form onSubmit={guardarEmpleado} className="edit-form">
                 <Entrada label="Nombres" value={nombres} onChange={setNombres}/>
                 <Entrada label="Apellidos" value={apellidos} onChange={setApellidos}/>
                 <label className="field"><span>DUI (opcional)</span>
                   <input inputMode="numeric" pattern="[0-9]{8}-[0-9]" maxLength={10} placeholder="00000000-0"
                     value={duiEdicion} onChange={e => setDuiEdicion(e.target.value)}/>
                 </label>
                 <label className="field"><span>Teléfono (opcional)</span>
                   <input type="tel" pattern="[0-9]{4}-[0-9]{4}" maxLength={9} placeholder="0000-0000"
                     value={telefonoEdicion} onChange={e => setTelefonoEdicion(e.target.value)}/>
                 </label>
                 <label className="field"><span>Correo de contacto (opcional)</span>
                   <input type="email" maxLength={150} value={correoEdicion}
                     onChange={e => setCorreoEdicion(e.target.value)}/>
                 </label>
                 <label className="field"><span>Registro profesional (opcional)</span>
                   <input maxLength={40} value={registroEdicion}
                     onChange={e => setRegistroEdicion(e.target.value)}/>
                 </label>
                 <label className="field"><span>Fecha de ingreso</span>
                   <input type="date" value={ingresoEdicion} onChange={e => setIngresoEdicion(e.target.value)}/>
                 </label>
                 <label className="field"><span>Estado laboral</span>
                   <select value={estadoEdicion} onChange={e=>setEstadoEdicion(e.target.value as 'activo'|'suspendido'|'inactivo')}>
                     <option value="activo">Activo</option><option value="suspendido">Suspendido</option><option value="inactivo">Inactivo</option>
                   </select>
                 </label>
                 <p className="edit-note">Las cuentas vinculadas y las asignaciones con historial tienen restricciones de seguridad e integridad.</p>
                 <button className="button primary" type="submit" disabled={guardando}>
                   {guardando ? 'Guardando…' : 'Guardar cambios'}
                 </button>
               </form>}
               <button type="button" className="button ghost dangerous employee-delete-action"
                 disabled={guardando} onClick={eliminarEmpleado}>Eliminar empleado</button>
             </>}
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
