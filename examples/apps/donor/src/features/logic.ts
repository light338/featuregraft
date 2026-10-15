export interface CatalogItem { id: string; name: string; category: string; }
export function selectRows<T extends CatalogItem>(items:T[],query:string,category:string,direction:'asc'|'desc'):T[] {
  const needle=query.trim().toLocaleLowerCase();
  return items.filter(item=>(category==='All'||item.category===category)&&item.name.toLocaleLowerCase().includes(needle))
    .sort((a,b)=>a.name.localeCompare(b.name)*(direction==='asc'?1:-1));
}
export function csvCell(value:unknown):string {
  const text=String(value);return /[",\r\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;
}
export function exportRows(items:CatalogItem[]):string {
  return ['Name,Category',...items.map(item=>[item.name,item.category].map(csvCell).join(','))].join('\r\n');
}
