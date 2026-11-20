import type { Empleado } from './api';

type Perfil = Pick<Empleado, 'nombres' | 'apellidos' | 'foto_url' | 'foto_data_url'>;

/**
 * Los retratos DEMO- son imágenes sintéticas originales, no personas reales.
 * Una cuadrícula JPEG de 4x4 permite reutilizar 16 retratos sin duplicar el peso.
 */
export default function AvatarEmpleado({
  empleado, size = 'normal'
}: { empleado: Perfil; size?: 'normal' | 'grande' }) {
  const original = empleado.foto_data_url || empleado.foto_url || null;
  const nombre = (empleado.nombres + ' ' + empleado.apellidos).trim();
  const indice = original && !empleado.foto_data_url
    ? /^\/retratos\/avatar-(\d{2})\.svg$/.exec(original)
    : null;
  // En el catálogo ficticio los índices 01–08 se asignaron a perfiles
  // masculinos y 09–16 a perfiles femeninos; el mosaico original está mixto.
  const ordenRealista = [0, 2, 5, 7, 8, 10, 12, 14, 1, 3, 4, 6, 9, 11, 13, 15];
  const numeroReferencia = indice ? Number(indice[1]) - 1 : -1;
  const posicion = numeroReferencia >= 0 && numeroReferencia < 16
    ? ordenRealista[numeroReferencia] : -1;
  const retratoDemo = posicion >= 0 && posicion < 16;
  const x = (posicion % 4) * (100 / 3);
  const y = Math.floor(posicion / 4) * (100 / 3);
  return (
    <span className={'employee-avatar' + (size === 'grande' ? ' employee-avatar-large' : '')}>
      {retratoDemo ? (
        <span className="employee-avatar-portrait"
          role="img" aria-label={'Retrato sintético ilustrativo de ' + nombre}
          style={{
            backgroundImage: "url('/retratos/equipo-realista.jpg')",
            backgroundPosition: `${x}% ${y}%`
          }}/>
      ) : original ? (
        <img src={original} alt={'Fotografía de ' + nombre} loading="lazy" decoding="async"
          onError={e => {e.currentTarget.style.display='none';}}/>
      ) : null}
      <svg className="employee-avatar-fallback" aria-hidden="true" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="18" r="8" fill="currentColor"/>
        <path d="M9 42c0-9 6.5-15 15-15s15 6 15 15" fill="currentColor"/>
      </svg>
    </span>
  );
}
