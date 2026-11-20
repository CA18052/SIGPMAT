import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ApiError, requestApi } from './api';
import type { Departamento } from './api';

type Cargo = { id_cargo: string; nombre: string; categoria: string };
type Foto = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string; vistaPrevia: string };
type Formulario = {
  codigo_empleado: string;
  nombres: string;
  apellidos: string;
  dui: string;
  correo_contacto: string;
  telefono: string;
  numero_registro_profesional: string;
  id_cargo: string;
  id_departamento: string;
  fecha_ingreso: string;
};

function formatoDui(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 9);
  return digitos.length > 8 ? digitos.slice(0, 8) + '-' + digitos.slice(8) : digitos;
}

function formatoTelefono(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  return digitos.length > 4 ? digitos.slice(0, 4) + '-' + digitos.slice(4) : digitos;
}

async function prepararFotografia(archivo: File): Promise<Foto> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
    throw new Error('Selecciona una imagen JPG, PNG o WebP.');
  }
  if (archivo.size > 10 * 1024 * 1024) {
    throw new Error('El archivo original debe pesar menos de 10 MB.');
  }
  const bitmap = await createImageBitmap(archivo);
  try {
    const canvas = document.createElement('canvas');
    const factor = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * factor));
    canvas.height = Math.max(1, Math.round(bitmap.height * factor));
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('No se pudo procesar la fotografía.');
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let uri = canvas.toDataURL('image/webp', 0.76);
    if (uri.length > 275000) uri = canvas.toDataURL('image/jpeg', 0.62);
    const [prefijo, base64] = uri.split(',');
    const mime = prefijo.match(/^data:(image\/(?:jpeg|png|webp));base64$/)?.[1] as Foto['mime'] | undefined;
    if (!mime || !base64 || Math.ceil(base64.length * 3 / 4) > 200000) {
      throw new Error('La fotografía sigue siendo demasiado grande después de optimizarla.');
    }
    return { mime, base64, vistaPrevia: uri };
  } finally {
    bitmap.close();
  }
}

export default function NuevoEmpleado({
  token, departamentos, onCerrar, onGuardado, onSesionExpirada
}: {
  token: string;
  departamentos: Departamento[];
  onCerrar: () => void;
  onGuardado: (codigo: string) => void;
  onSesionExpirada: () => void;
}) {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [foto, setFoto] = useState<Foto | null>(null);
  const [error, setError] = useState('');
  const [formulario, setFormulario] = useState<Formulario>({
    codigo_empleado: '', nombres: '', apellidos: '', dui: '',
    correo_contacto: '', telefono: '', numero_registro_profesional: '',
    id_cargo: '', id_departamento: '', fecha_ingreso: ''
  });

  useEffect(() => {
    let activo = true;
    requestApi<{ cargos: Cargo[] }>('/api/cargos', token)
      .then(r => { if (activo) setCargos(r.cargos); })
      .catch((e: unknown) => {
        if (!activo) return;
        if (e instanceof ApiError && e.status === 401) onSesionExpirada();
        else setError(e instanceof Error ? e.message : 'No se pudieron cargar los cargos');
      })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [token, onSesionExpirada]);

  function cambiar(campo: keyof Formulario, valor: string) {
    setFormulario(v => ({ ...v, [campo]: valor }));
  }

  async function seleccionarFoto(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    setProcesandoFoto(true);
    setError('');
    try {
      setFoto(await prepararFotografia(archivo));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar la imagen');
    } finally {
      setProcesandoFoto(false);
      evento.target.value = '';
    }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando || cargando || procesandoFoto) return;
    setError('');
    setGuardando(true);
    try {
      const codigo = formulario.codigo_empleado.trim().toUpperCase();
      const respuesta = await requestApi<{ empleado: { id_empleado: string; codigo_empleado: string } }>(
        '/api/empleados', token, {
          method: 'POST',
          body: JSON.stringify({
            codigo_empleado: codigo,
            nombres: formulario.nombres.trim(),
            apellidos: formulario.apellidos.trim(),
            id_cargo: formulario.id_cargo,
            id_departamento: formulario.id_departamento,
            ...(formulario.fecha_ingreso ? { fecha_ingreso: formulario.fecha_ingreso } : {}),
            ...(formulario.dui ? { dui: formulario.dui } : {}),
            ...(formulario.correo_contacto.trim() ? { correo_contacto: formulario.correo_contacto.trim() } : {}),
            ...(formulario.telefono ? { telefono: formulario.telefono } : {}),
            ...(formulario.numero_registro_profesional.trim()
              ? { numero_registro_profesional: formulario.numero_registro_profesional.trim() } : {}),
            ...(foto ? { foto_mime: foto.mime, foto_base64: foto.base64 } : {})
          })
        }
      );
      onGuardado(respuesta.empleado.codigo_empleado);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onSesionExpirada();
      else setError(e instanceof Error ? e.message : 'No se pudo guardar el empleado');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={e => {
      if (e.target === e.currentTarget && !guardando) onCerrar();
    }}>
      <section className="drawer employee-register-drawer" role="dialog" aria-modal="true"
        aria-labelledby="nuevo-empleado-titulo">
        <div className="drawer-header">
          <span className="eyebrow">PERSONAL HOSPITALARIO</span>
          <button type="button" className="icon-btn" aria-label="Cerrar formulario"
            disabled={guardando} onClick={onCerrar}>✕</button>
        </div>
        <h2 id="nuevo-empleado-titulo">Registrar empleado</h2>
        <p className="muted employee-form-intro">
          Datos del expediente laboral de demostración. Los campos opcionales pueden completarse después.
        </p>
        {error && <div role="alert" className="alert">! {error}</div>}
        <form className="employee-form" onSubmit={guardar}>
          <div className="employee-photo-field">
            <div className="photo-preview" aria-hidden="true">
              {foto ? <img src={foto.vistaPrevia} alt="" /> :
                <svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="18" r="8" fill="currentColor"/><path d="M9 42c0-9 6.5-15 15-15s15 6 15 15" fill="currentColor"/></svg>}
            </div>
            <div className="employee-photo-copy">
              <strong>Fotografía del empleado</strong>
              <span>Opcional · JPG, PNG o WebP</span>
              <label className="button ghost photo-upload-button">
                {procesandoFoto ? 'Optimizando imagen…' : foto ? 'Cambiar fotografía' : 'Seleccionar fotografía'}
                <input type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={seleccionarFoto} disabled={guardando || procesandoFoto} />
              </label>
              {foto && <button type="button" className="text-button photo-remove-button"
                onClick={() => setFoto(null)}>Quitar fotografía</button>}
            </div>
          </div>
          <label>Código institucional
            <input autoFocus required maxLength={20} minLength={3} pattern="[A-Za-z0-9-]{3,20}"
              placeholder="HOSP-EMP-065" value={formulario.codigo_empleado}
              onChange={e => cambiar('codigo_empleado', e.target.value)}/>
          </label>
          <label>Nombres
            <input required maxLength={90} value={formulario.nombres}
              onChange={e => cambiar('nombres', e.target.value)} placeholder="Nombres del empleado"/>
          </label>
          <label>Apellidos
            <input required maxLength={90} value={formulario.apellidos}
              onChange={e => cambiar('apellidos', e.target.value)} placeholder="Apellidos del empleado"/>
          </label>
          <label>DUI (opcional)
            <input inputMode="numeric" maxLength={10} pattern="[0-9]{8}-[0-9]"
              value={formulario.dui} placeholder="00000000-0" autoComplete="off"
              onChange={e => cambiar('dui', formatoDui(e.target.value))}/>
            <small>Para la demostración, utiliza exclusivamente datos ficticios.</small>
          </label>
          <label>Correo de contacto (opcional)
            <input type="email" maxLength={150} autoComplete="off" placeholder="ejemplo@hospital.test"
              value={formulario.correo_contacto}
              onChange={e => cambiar('correo_contacto', e.target.value)}/>
          </label>
          <label>Teléfono (opcional)
            <input type="tel" inputMode="numeric" maxLength={9} pattern="[0-9]{4}-[0-9]{4}"
              placeholder="0000-0000" value={formulario.telefono}
              onChange={e => cambiar('telefono', formatoTelefono(e.target.value))}/>
          </label>
          <label>Registro profesional (opcional)
            <input maxLength={40} placeholder="Número de inscripción si corresponde"
              value={formulario.numero_registro_profesional}
              onChange={e => cambiar('numero_registro_profesional', e.target.value)}/>
          </label>
          <label>Cargo
            <select required value={formulario.id_cargo}
              onChange={e => cambiar('id_cargo', e.target.value)} disabled={cargando}>
              <option value="">{cargando ? 'Cargando cargos…' : 'Seleccionar cargo'}</option>
              {cargos.map(c => <option key={c.id_cargo} value={c.id_cargo}>{c.nombre}</option>)}
            </select>
          </label>
          <label>Departamento
            <select required value={formulario.id_departamento}
              onChange={e => cambiar('id_departamento', e.target.value)}>
              <option value="">Seleccionar departamento</option>
              {departamentos.map(d => <option key={d.id_departamento} value={d.id_departamento}>{d.nombre}</option>)}
            </select>
          </label>
          <label>Fecha de ingreso (opcional)
            <input type="date" value={formulario.fecha_ingreso}
              onChange={e => cambiar('fecha_ingreso', e.target.value)}/>
          </label>
          <div className="employee-form-actions">
            <button type="button" className="button ghost" onClick={onCerrar}
              disabled={guardando}>Cancelar</button>
            <button className="button primary" type="submit"
              disabled={guardando || cargando || procesandoFoto || cargos.length === 0}>
              {guardando ? 'Registrando…' : 'Registrar empleado'}
            </button>
          </div>
          <p className="muted employee-form-note">
            La fotografía es opcional. Sin ella aparecerá una silueta. Solo ADMIN_GENERAL puede crear empleados.
          </p>
        </form>
      </section>
    </div>
  );
}
