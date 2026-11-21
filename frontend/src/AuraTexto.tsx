import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { analizarMarkdownAura } from './auraMarkdown';

const marcaCodigo=String.fromCharCode(96);
const patron=/(\*\*[^*]+\*\*|~~[^~]+~~|\x60[^\x60]+\x60|\*[^*\n]+\*|\[[^\]]+\]\([^)]+\))/g;

/**
 * Se interpretan solamente marcas de estilo. El contenido recibido de la IA
 * NO se procesa como HTML, ni genera imágenes, scripts o enlaces externos.
 */
function enLinea(texto:string):ReactNode[]{
  const partes:ReactNode[]=[];
  let indice=0;
  for(const coincide of texto.matchAll(patron)){
    const inicio=coincide.index??0,fragmento=coincide[0];
    if(inicio>indice)partes.push(texto.slice(indice,inicio));
    const key=String(inicio);
    if(fragmento.startsWith('**'))
      partes.push(<strong key={key}>{fragmento.slice(2,-2)}</strong>);
    else if(fragmento.startsWith('~~'))
      partes.push(<del key={key}>{fragmento.slice(2,-2)}</del>);
    else if(fragmento.startsWith(marcaCodigo))
      partes.push(<code key={key}>{fragmento.slice(1,-1)}</code>);
    else if(fragmento.startsWith('*'))
      partes.push(<em key={key}>{fragmento.slice(1,-1)}</em>);
    else if(fragmento.startsWith('[')){
      const cierre=fragmento.indexOf(']');
      partes.push(<span key={key}>{fragmento.slice(1,cierre)}</span>);
    }else partes.push(fragmento);
    indice=inicio+fragmento.length;
  }
  if(indice<texto.length)partes.push(texto.slice(indice));
  return partes;
}
export default function AuraTexto({texto}:{texto:string}){
  const bloques=useMemo(()=>analizarMarkdownAura(texto),[texto]);
  return <div className="aura-rich-text">
    {bloques.map((b,i)=>{
      if(b.tipo==='parrafo')return <p key={i}>{enLinea(b.texto)}</p>;
      if(b.tipo==='titulo')return <h3 key={i}>{enLinea(b.texto)}</h3>;
      if(b.tipo==='cita')return <blockquote key={i}>{enLinea(b.texto)}</blockquote>;
      if(b.tipo==='codigo')return <pre key={i}><code>{b.texto}</code></pre>;
      if(b.tipo==='separador')return <hr key={i}/>;
      if(b.tipo==='lista'){
        const elementos=b.elementos.map((item,j)=><li key={j}>{enLinea(item)}</li>);
        return b.ordenada?<ol key={i}>{elementos}</ol>:<ul key={i}>{elementos}</ul>;
      }
      return <div key={i} className="aura-table-scroll" role="region"
        aria-label="Tabla de resultados de AURA" tabIndex={0}>
        <table><thead><tr>{b.encabezados.map((enc,j)=>
          <th scope="col" key={j}>{enLinea(enc)}</th>)}</tr></thead>
          <tbody>{b.filas.map((fila,j)=><tr key={j}>
            {fila.map((celda,k)=><td key={k}>{enLinea(celda)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>;
    })}
  </div>;
}
