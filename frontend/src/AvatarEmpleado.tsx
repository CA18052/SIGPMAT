import type { Empleado } from './api';

type Perfil = Pick<Empleado, 'nombres' | 'apellidos' | 'foto_url' | 'foto_data_url'>;

export default function AvatarEmpleado({
  empleado, size = 'normal'
}: { empleado: Perfil; size?: 'normal' | 'grande' }) {
  const src = empleado.foto_data_url || empleado.foto_url || null;
  const nombre = (empleado.nombres + ' ' + empleado.apellidos).trim();
  return (
    <span className={'employee-avatar' + (size === 'grande' ? ' employee-avatar-large' : '')}>
      {src ? (
        <img src={src} alt={'Retrato de referencia para ' + nombre}
          loading="lazy" decoding="async" onError={e => { e.currentTarget.style.display = 'none'; }}/>
      ) : null}
      <svg className="employee-avatar-fallback" aria-hidden="true" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="18" r="8" fill="currentColor"/>
        <path d="M9 42c0-9 6.5-15 15-15s15 6 15 15" fill="currentColor"/>
      </svg>
    </span>
  );
}
