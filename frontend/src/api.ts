export interface Usuario {
  id_usuario: string;
  nombre_usuario: string;
  roles: string[];
}

export interface Sesion {
  access_token: string;
  token_type: 'Bearer';
  expires_in_seconds: number;
  usuario: Usuario;
}

export interface Departamento {
  id_departamento: string;
  codigo: string;
  nombre: string;
  ubicacion?: string | null;
  empleados_activos?: number;
}

export interface Empleado {
  id_empleado: string;
  codigo_empleado: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  estado_vinculo: string;
  foto_url?: string | null;
  foto_data_url?: string | null;
}

export interface EmpleadoDetalle extends Empleado {
  fecha_ingreso: string | null;
  dui?: string | null;
  correo_contacto?: string | null;
  telefono?: string | null;
  numero_registro_profesional?: string | null;
  departamentos: Departamento[];
}

export interface Acreditacion {
  id_empleado_especialidad: string;
  codigo: string;
  nombre: string;
  fecha_acreditacion: string;
  vigente_desde: string;
  vigente_hasta: string | null;
  es_principal: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function requestApi<T>(
  path: string,
  token: string | null = null,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con SIGPMAT API. Comprueba que Fastify esté encendido.');
  }

  let result: unknown = null;
  try { result = await response.json(); } catch { /* Respuesta sin cuerpo JSON */ }
  if (!response.ok) {
    const message = typeof result === 'object' && result !== null && 'error' in result
      ? String((result as { error: unknown }).error)
      : 'La solicitud no se pudo completar.';
    throw new ApiError(response.status, message);
  }
  return result as T;
}

export function iniciarSesion(usuario: string, contrasena: string): Promise<Sesion> {
  return requestApi<Sesion>('/api/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ nombre_usuario: usuario.trim(), contrasena })
  });
}
