/** Diagnóstico seguro de fallos de IA: nunca persistir ni devolver cuerpos de Groq. */
export type CausaAura =
  | 'LIMITE' | 'CREDENCIAL' | 'HERRAMIENTA_INVALIDA'
  | 'SOLICITUD_INVALIDA' | 'NO_DISPONIBLE';

export class FalloProveedorAura extends Error {
  constructor(
    public readonly causa:CausaAura,
    public readonly status:number,
    public readonly tipo:string,
    public readonly codigo:string
  ){super(causa);}
}

/** Lee únicamente campos de clasificación; failed_generation puede contener prompts y NO se registra. */
export function diagnosticarErrorAura(status:number, cuerpo:unknown):FalloProveedorAura {
  const raiz=(cuerpo && typeof cuerpo==='object') ? cuerpo as Record<string,unknown>:{};
  const error=(raiz.error && typeof raiz.error==='object')
    ? raiz.error as Record<string,unknown>:{};
  const seguro=(v:unknown)=>typeof v==='string'&&/^[a-z0-9_./-]{1,65}$/i.test(v)?v:'no_especificado';
  const tipo=seguro(error.type),codigo=seguro(error.code);
  if(status===429)return new FalloProveedorAura('LIMITE',status,tipo,codigo);
  if(status===401||status===403)return new FalloProveedorAura('CREDENCIAL',status,tipo,codigo);
  // Groq puede rechazar un llamado a función generado por el modelo.
  const fallido=Object.prototype.hasOwnProperty.call(error,'failed_generation') ||
    codigo==='tool_use_failed'||codigo==='tool_call_invalid'||
    (typeof error.message==='string' && /(?:invalid|failed|malformed) tool call/i.test(error.message));
  if((status===400||status===422)&&fallido)
    return new FalloProveedorAura('HERRAMIENTA_INVALIDA',status,tipo,codigo);
  if(status===400||status===404||status===413||status===422)
    return new FalloProveedorAura('SOLICITUD_INVALIDA',status,tipo,codigo);
  return new FalloProveedorAura('NO_DISPONIBLE',status,tipo,codigo);
}

export function mensajeErrorAura(causa:CausaAura,proveedor:'groq'|'openai'):string {
  switch(causa){
    case 'LIMITE':return 'Se alcanzó el límite de la cuota gratuita. Intenta nuevamente más tarde; AURA no utilizará una API de pago.';
    case 'CREDENCIAL':return 'La clave de '+(proveedor==='groq'?'Groq':'OpenAI')+' no es válida o no tiene permisos.';
    case 'HERRAMIENTA_INVALIDA':return 'El modelo no pudo preparar correctamente la función solicitada. Prueba de nuevo o consulta las recomendaciones desde Turnos.';
    case 'SOLICITUD_INVALIDA':return 'El proveedor rechazó el formato de la solicitud. No se modificaron datos. Consulta el diagnóstico técnico de AURA.';
    default:return 'El proveedor de IA no está disponible temporalmente. No se modificaron datos.';
  }
}
