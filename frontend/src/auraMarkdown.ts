/**
 * Subconjunto seguro del Markdown habitual de AURA.
 * No produce HTML ni interpreta enlaces externos o imágenes.
 * React escapa los textos antes de mostrarlos.
 */
export type BloqueAura =
  | {tipo:'parrafo'|'cita'|'codigo'|'titulo';texto:string;nivel?:number}
  | {tipo:'tabla';encabezados:string[];filas:string[][]}
  | {tipo:'lista';ordenada:boolean;elementos:string[]}
  | {tipo:'separador'};

const titulo=/^(#{1,3})\s+(.+)$/;
const lineaLista=/^\s{0,3}([-*+]|\d+[.)])\s+(.+)$/;
const separadorTabla=(s:string)=>/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(s);
const separadorHorizontal=(s:string)=>/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(s);
const esTabla=(s:string)=>s.includes('|')&&s.trim().startsWith('|');
const delimitadorCodigo=String.fromCharCode(96).repeat(3);
function celdas(s:string):string[]{
  const limpio=s.trim().replace(/^\|/,'').replace(/\|$/,'');
  return limpio.split('|').map(c=>c.trim());
}
function iniciaBloque(s:string,proximo:string=''):boolean{
  return Boolean(titulo.test(s)||lineaLista.test(s)||s.trimStart().startsWith('>')||
    s.trimStart().startsWith(delimitadorCodigo)||separadorHorizontal(s)||
    (esTabla(s)&&separadorTabla(proximo)));
}

export function analizarMarkdownAura(entrada:string):BloqueAura[]{
  const lineas=entrada.replace(/\r\n?/g,'\n').split('\n');
  const bloques:BloqueAura[]=[];
  let i=0;
  while(i<lineas.length){
    const actual=lineas[i].trim();
    if(!actual){i++;continue;}
    if(actual.startsWith(delimitadorCodigo)){
      const contenido:string[]=[];i++;
      while(i<lineas.length&&!lineas[i].trim().startsWith(delimitadorCodigo))
        contenido.push(lineas[i++]);
      if(i<lineas.length)i++;
      bloques.push({tipo:'codigo',texto:contenido.join('\n')});continue;
    }
    const coincideTitulo=actual.match(titulo);
    if(coincideTitulo){
      bloques.push({tipo:'titulo',nivel:coincideTitulo[1].length,texto:coincideTitulo[2]});
      i++;continue;
    }
    if(esTabla(actual)&&i+1<lineas.length&&separadorTabla(lineas[i+1])){
      const encabezados=celdas(actual);
      i+=2;const filas:string[][]=[];
      while(i<lineas.length&&esTabla(lineas[i])&&lineas[i].trim()){
        const fila=celdas(lineas[i]);filas.push(encabezados.map((_,col)=>fila[col]??''));
        i++;
      }
      bloques.push({tipo:'tabla',encabezados,filas});continue;
    }
    if(lineaLista.test(actual)){
      const ordenada=/^\d+[.)]\s/.test(actual);
      const elementos:string[]=[];
      while(i<lineas.length){
        const l=lineas[i].trim().match(lineaLista);
        if(!l||/^\d/.test(l[1])!==ordenada)break;
        elementos.push(l[2]);i++;
      }
      bloques.push({tipo:'lista',ordenada,elementos});continue;
    }
    if(actual.startsWith('>')){
      const cita:string[]=[];
      while(i<lineas.length&&lineas[i].trim().startsWith('>'))
        cita.push(lineas[i++].trim().replace(/^>\s?/,''));
      bloques.push({tipo:'cita',texto:cita.join(' ')});continue;
    }
    if(separadorHorizontal(actual)){
      bloques.push({tipo:'separador'});i++;continue;
    }
    const parrafo:string[]=[actual];i++;
    while(i<lineas.length&&lineas[i].trim()&&!iniciaBloque(lineas[i].trim(),lineas[i+1]??'')){
      parrafo.push(lineas[i].trim());i++;
    }
    bloques.push({tipo:'parrafo',texto:parrafo.join('\n')});
  }
  return bloques;
}
