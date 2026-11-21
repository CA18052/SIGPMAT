/**
 * Selector seguro de proveedor AURA.
 * Por defecto SOLO Groq; no caer a OpenAI (facturable) si la cuota gratuita
 * se agota o GROQ_API_KEY está ausente.
 */
export type ProveedorAura = {
  tipo: 'groq' | 'openai';
  endpoint: string;
  modelo: string;
  clave: string;
};

export function seleccionarProveedorAura(
  variables: Record<string,string|undefined> = process.env
): ProveedorAura | null {
  const elegido = variables.AURA_PROVEEDOR?.trim().toLowerCase() || 'groq';
  if(elegido === 'groq'){
    const clave = variables.GROQ_API_KEY?.trim();
    return clave ? {
      tipo:'groq',clave,
      endpoint:'https://api.groq.com/openai/v1/responses',
      modelo:variables.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b'
    } : null;
  }
  if(elegido === 'openai'){
    const clave = variables.OPENAI_API_KEY?.trim();
    return clave ? {
      tipo:'openai',clave,
      endpoint:'https://api.openai.com/v1/responses',
      modelo:variables.OPENAI_MODEL?.trim() || 'gpt-4.1-mini'
    } : null;
  }
  // Configuración desconocida: no acceder a proveedores ni producir gastos.
  return null;
}

export function cargaProveedorAura(
  datos:Record<string,unknown>,
  proveedor:ProveedorAura
):Record<string,unknown>{
  const {store:_almacenamiento,...sinStore}=datos;
  // Groq Responses API (beta) aún no acepta el parámetro store.
  return proveedor.tipo==='groq'?sinStore:{...sinStore,store:false};
}
