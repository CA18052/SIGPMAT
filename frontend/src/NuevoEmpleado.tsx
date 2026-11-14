import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, requestApi } from './api';
import type { Departamento } from './api';

type Cargo = { id_cargo: string; nombre: string; categoria: string };

type Formulario = {
  codigo_empleado: string;
  nombres: string;
  apellidos: string;
  id_cargo: string;
  id_departamento: string;
  fecha_ingreso: string;
};

export default function NuevoEmpleado({
  token,
  departamentos,
  onCerrar,
  onGuardado,
  onSesionExpirada
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
  const [error, setError] = useState('');
  const [formulario, setFormulario] = useState<Formulario>({
    codigo_empleado: '',
    nombres: '',
    apellidos: '',
    id_cargo: '',
    id_departamento: '',
    fecha_ingreso: ''
  });

  useEffect(() => {
    let activo = true;
    requestApi<{ cargos: Cargo[] }>('/api/cargos', token)
      .then((r) => { if (activo) setCargos(r.cargos); })
      .catch((e: unknown) => {
        if (!activo) return;
        if (e instanceof ApiError && e.status === 401) onSesionExpirada();
        else setError(e instanceof Error ? e.message : 'No se pudieron cargar los cargos');
      })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [token, onSesionExpirada]);

  function cambiar(campo: keyof Formulario, valor: string) {
    setFormulario((v) => ({ ...v, [campo]: valor }));
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando || cargando) return;

    setError('');
    setGuardando(true);
    try {
      const codigo = formulario.codigo_empleado.trim().toUpperCase();
      const respuesta = await requestApi<{ empleado: {
        id_empleado: string; codigo_empleado: string;
      } }>('/api/empleados', token, {
        method: 'POST',
        body: JSON.stringify({
          codigo_empleado: codigo,
          nombres: formulario.nombres.trim(),
          apellidos: formulario.apellidos.trim(),
          id_cargo: formulario.id_cargo,
          id_departamento: formulario.id_departamento,
          ...(formulario.fecha_ingreso ? { fecha_ingreso: formulario.fecha_ingreso } : {})
        })
      });
      onGuardado(respuesta.empleado.codigo_empleado);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onSesionExpirada();
      else setError(e instanceof Error ? e.message : 'No se pudo guardar el empleado');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={(e) => {
      if (e.target === e.currentTarget && !guardando) onCerrar();
    }}>
      <section className="drawer" role="dialog" aria-modal="true"
        aria-labelledby="nuevo-empleado-titulo">
        <div className="drawer-header">
          <span className="eyebrow">PERSONAL HOSPITALARIO</span>
          <button type="button" className="icon-btn" aria-label="Cerrar formulario"
            disabled={guardando} onClick={onCerrar}>✕</button>
        </div>
        <h2 id="nuevo-empleado-titulo">Registrar empleado</h2>
        <p className="muted employee-form-intro">
          Los datos se guardarán en el registro de empleados y en su departamento.
        </p>
        {error && <div role="alert" className="alert">! {error}</div>}
        <form className="employee-form" onSubmit={guardar}>
          <label>Código del empleado
            <input autoFocus required maxLength={20} minLength={3}
              pattern="[A-Za-z0-9-]{3,20}"
              placeholder="DEV-EMP-004"
              value={formulario.codigo_empleado}
              onChange={(e) => cambiar('codigo_empleado', e.target.value)}/>
          </label>
          <label>Nombres
            <input required maxLength={90} value={formulario.nombres}
              onChange={(e) => cambiar('nombres', e.target.value)}
              placeholder="Nombres del empleado"/>
          </label>
          <label>Apellidos
            <input required maxLength={90} value={formulario.apellidos}
              onChange={(e) => cambiar('apellidos', e.target.value)}
              placeholder="Apellidos del empleado"/>
          </label>
          <label>Cargo
            <select required value={formulario.id_cargo}
              onChange={(e) => cambiar('id_cargo', e.target.value)}
              disabled={cargando}>
              <option value="">{cargando ? 'Cargando cargos…' : 'Seleccionar cargo'}</option>
              {cargos.map((c) => <option key={c.id_cargo} value={c.id_cargo}>
                {c.nombre}
              </option>)}
            </select>
          </label>
          <label>Departamento
            <select required value={formulario.id_departamento}
              onChange={(e) => cambiar('id_departamento', e.target.value)}>
              <option value="">Seleccionar departamento</option>
              {departamentos.map((d) => <option key={d.id_departamento} value={d.id_departamento}>
                {d.nombre}
              </option>)}
            </select>
          </label>
          <label>Fecha de ingreso (opcional)
            <input type="date" value={formulario.fecha_ingreso}
              onChange={(e) => cambiar('fecha_ingreso', e.target.value)}/>
          </label>
          <div className="employee-form-actions">
            <button type="button" className="button ghost" onClick={onCerrar}
              disabled={guardando}>Cancelar</button>
            <button className="button primary" type="submit"
              disabled={guardando || cargando || cargos.length === 0}>
              {guardando ? 'Registrando…' : 'Registrar empleado'}
            </button>
          </div>
          <p className="muted employee-form-note">
            La operación utiliza datos de ensayo. Solo ADMIN_GENERAL puede crear empleados.
          </p>
        </form>
      </section>
    </div>
  );
}
