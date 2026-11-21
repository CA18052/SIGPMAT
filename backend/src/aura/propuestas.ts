import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

export type TipoAccionAura = 'crear_turno' | 'crear_empleado' | 'asignar_empleado';
export type AccionAura = {
  tipo: TipoAccionAura;
  usuario: string;
  vence: number;
  nonce: string;
  metodo: 'POST';
  ruta: string;
  datos: Record<string, unknown>;
  resumen: string;
};

const SECRETO = process.env.JWT_SECRET;
function firmar(texto: string) {
  if (!SECRETO || !/^[a-f0-9]{96}$/.test(SECRETO)) throw new Error('Falta JWT_SECRET');
  return createHmac('sha256', Buffer.from(SECRETO, 'hex')).update('SIGPMAT-AURA-v1:' + texto).digest('base64url');
}

export function crearPropuesta(
  usuario: string, tipo: TipoAccionAura, ruta: string,
  datos: Record<string,unknown>, resumen: string
): {ticket: string; resumen: string; expira_en_segundos: number; tipo: TipoAccionAura} {
  const accion: AccionAura = {
    tipo, usuario, vence: Date.now() + 5 * 60_000,
    nonce: randomBytes(12).toString('base64url'),
    metodo: 'POST', ruta, datos, resumen
  };
  const cuerpo = Buffer.from(JSON.stringify(accion)).toString('base64url');
  return { ticket: cuerpo + '.' + firmar(cuerpo), resumen, expira_en_segundos: 300, tipo };
}

export function verificarPropuesta(ticket:string, usuario:string):AccionAura|null {
  if(typeof ticket !== 'string' || ticket.length > 3500 ||
     !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
  const [cuerpo, firma] = ticket.split('.');
  if(!cuerpo || !firma) return null;
  const esperado = firmar(cuerpo);
  if(!timingSafeEqual(Buffer.from(firma),Buffer.from(esperado)))return null;
  try {
    const accion=JSON.parse(Buffer.from(cuerpo,'base64url').toString('utf8')) as AccionAura;
    if(!accion || accion.usuario!==usuario || accion.vence<=Date.now() ||
      accion.vence>Date.now()+5*60_000 || accion.metodo!=='POST' ||
      typeof accion.nonce!=='string' || typeof accion.resumen!=='string' ||
      !accion.datos || typeof accion.datos!=='object' || Array.isArray(accion.datos)) return null;
    const rutas:Record<TipoAccionAura,RegExp>={
      crear_turno:/^\/api\/turnos$/,
      crear_empleado:/^\/api\/empleados$/,
      asignar_empleado:/^\/api\/turnos\/[1-9][0-9]{0,17}\/asignaciones$/
    };
    if(!rutas[accion.tipo]?.test(accion.ruta))return null;
    return accion;
  } catch{return null;}
}
