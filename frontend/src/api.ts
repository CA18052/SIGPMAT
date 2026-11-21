export interface Usuario {
  id_usuario: string;
  nombre_usuario: string;
  roles: string[];
  nombre_mostrado?: string | null;
  tipo_cuenta?: string;
  es_superadministrador?: boolean;
  debe_cambiar_contrasena?: boolean;
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
  extension?: string | null;
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
  constructor(
    public status: number, message: string,
    public motivo?: string, public solucion?: string,
    public codigo?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type SolicitudConfirmacion = { metodo: string; ruta: string };
type PedirContrasena = (solicitud: SolicitudConfirmacion) => Promise<string | null>;
let proveedorConfirmacion: PedirContrasena | null = null;

export function establecerProveedorConfirmacion(proveedor: PedirContrasena | null) {
  proveedorConfirmacion = proveedor;
}

const EXENTAS_CONFIRMACION = new Set([
  '/api/auth/login','/api/auth/registrar','/api/auth/cambiar-contrasena',
  '/api/auth/confirmar-operacion',
  '/api/aura/mensaje' // Consulta IA no modifica base de datos
]);

export async function registrarVisitante(carnet: string, contrasena: string, nombre_mostrado?: string) {
  return requestApi<{registrado:boolean;mensaje:string;nombre_usuario:string;permisos:string}>(
    '/api/auth/registrar',null,{
      method:'POST',
      body:JSON.stringify({carnet,contrasena,...(nombre_mostrado?{nombre_mostrado}:{})})
    });
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

  const metodo=(init.method||'GET').toUpperCase();
  const ruta=path.split('?')[0];
  const necesitaConfirmacion=token && ['POST','PUT','PATCH','DELETE'].includes(metodo)
    && !EXENTAS_CONFIRMACION.has(ruta);
  if(necesitaConfirmacion){
    if(!proveedorConfirmacion)throw new ApiError(428,'La confirmación de contraseña no está disponible. Vuelve a abrir el sistema.');
    const contrasena=await proveedorConfirmacion({metodo,ruta});
    if(contrasena===null)throw new ApiError(0,'Operación cancelada. No se modificó ningún dato.');
    let confirmado:{confirmacion:string};
    try {
      confirmado=await requestApi<{confirmacion:string}>(
        '/api/auth/confirmar-operacion',token,{
          method:'POST',body:JSON.stringify({contrasena,metodo,ruta})
        });
    }catch(e){
      // Contraseña equivocada no significa sesión vencida: no cerrar la cuenta.
      if(e instanceof ApiError && e.status===401 && /contraseña/i.test(e.message)){
        throw new ApiError(422,e.message);
      }
      throw e;
    }
    headers.set('X-SIGPMAT-Confirmacion',confirmado.confirmacion);
  }

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
    const detalle = typeof result === 'object' && result !== null
      ? result as { motivo?: unknown; solucion?: unknown; codigo?: unknown }
      : {};
    throw new ApiError(response.status, message,
      typeof detalle.motivo === 'string' ? detalle.motivo : undefined,
      typeof detalle.solucion === 'string' ? detalle.solucion : undefined,
      typeof detalle.codigo === 'string' ? detalle.codigo : undefined);
  }
  return result as T;
}

export function iniciarSesion(usuario: string, contrasena: string): Promise<Sesion> {
  return requestApi<Sesion>('/api/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ nombre_usuario: usuario.trim(), contrasena })
  });
}
