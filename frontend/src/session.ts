import type { Sesion, Usuario } from './api';

/**
 * Mantener el acceso al recargar la MISMA pestaña. No usar localStorage:
 * el token JWT debe desaparecer al cerrar la sesión de esta pestaña.
 * El servidor sigue validando JWT, cuenta y roles en cada petición.
 */
const CLAVE_SESION = 'sigpmat.sesion.v1';
const CLAVE_PAGINA = 'sigpmat.pagina.v1';

type SesionGuardada = {
  sesion: Sesion;
  venceEn: number;
};

export type PaginaGuardada = 'resumen' | 'empleados' | 'departamentos' | 'turnos' | 'usuarios' | 'auditoria' | 'reportes';

export function guardarSesionEnPestana(sesion: Sesion): void {
  try {
    // El JWT del backend dura 15 minutos. Nunca prolongarlo al recargar.
    const segundos = Math.min(900, Math.max(0, sesion.expires_in_seconds));
    const venceEn = Date.now() + segundos * 1000 - 5000;
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ sesion, venceEn }));
  } catch {
    // Bloqueo de almacenamiento del navegador: sesión sólo en memoria.
  }
}

export function recuperarSesionDePestana(): Sesion | null {
  try {
    const raw = sessionStorage.getItem(CLAVE_SESION);
    if (!raw) return null;
    const data: SesionGuardada = JSON.parse(raw) as SesionGuardada;
    const s = data?.sesion;
    if (
      !s || !Number.isFinite(data.venceEn) || data.venceEn <= Date.now() ||
      s.token_type !== 'Bearer' || typeof s.access_token !== 'string' ||
      !s.access_token || typeof s.usuario?.id_usuario !== 'string' ||
      typeof s.usuario?.nombre_usuario !== 'string' ||
      !Array.isArray(s.usuario.roles) ||
      !s.usuario.roles.every((rol) => typeof rol === 'string')
    ) {
      sessionStorage.removeItem(CLAVE_SESION);
      return null;
    }
    return s;
  } catch {
    try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* no disponible */ }
    return null;
  }
}

export function actualizarUsuarioDeSesion(usuario: Usuario): void {
  try {
    const raw = sessionStorage.getItem(CLAVE_SESION);
    if (!raw) return;
    const data = JSON.parse(raw) as SesionGuardada;
    if (
      data?.sesion && data.sesion.usuario.id_usuario === usuario.id_usuario &&
      Number.isFinite(data.venceEn) && data.venceEn > Date.now()
    ) {
      data.sesion.usuario = usuario;
      // Nunca renovar la fecha de expiración con la validación /auth/me.
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify(data));
    }
  } catch { /* no disponible */ }
}

export function borrarSesionDePestana(): void {
  try {
    sessionStorage.removeItem(CLAVE_SESION);
    sessionStorage.removeItem(CLAVE_PAGINA);
  } catch { /* no disponible */ }
}

export function guardarPaginaEnPestana(pagina: PaginaGuardada): void {
  try { sessionStorage.setItem(CLAVE_PAGINA, pagina); } catch { /* no disponible */ }
}

export function recuperarPaginaDePestana(): PaginaGuardada {
  try {
    const pagina = sessionStorage.getItem(CLAVE_PAGINA);
    if (pagina === 'empleados' || pagina === 'departamentos' || pagina === 'turnos' || pagina === 'usuarios' || pagina === 'auditoria' || pagina === 'reportes') {
      return pagina;
    }
  } catch { /* no disponible */ }
  return 'resumen';
}
