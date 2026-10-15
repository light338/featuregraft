import {useMemo,useState} from 'react';
import {type CatalogItem,selectRows,exportRows} from './logic';
import './table.css';

export function ProjectTable({items}:{items:CatalogItem[]}) {
  const [query,setQuery]=useState(''),[category,setCategory]=useState('All'),[direction,setDirection]=useState<'asc'|'desc'>('asc');
  const visible=useMemo(()=>selectRows(items,query,category,direction),[items,query,category,direction]);
  function download() {
    const url=URL.createObjectURL(new Blob([exportRows(visible)],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='projects.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="dt"><div className="dt-tools"><label>Search projects<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a project…" /></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option>All</option>{[...new Set(items.map(i=>i.category))].sort().map(c=><option key={c}>{c}</option>)}</select></label><button onClick={download}>Export CSV</button></div><table><thead><tr><th><button onClick={()=>setDirection(direction==='asc'?'desc':'asc')} aria-label="Sort by name">Name {direction==='asc'?'↑':'↓'}</button></th><th>Category</th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.category}</td></tr>)}</tbody></table><p className="dt-count">{visible.length} of {items.length} projects</p></section>;
}
