import {createRoot} from 'react-dom/client';
import {ProjectTable} from './features/ProjectTable';
import './style.css';
const items=[{id:'1',name:'Atlas redesign',category:'Active'},{id:'2',name:'Café storefront',category:'Active'},{id:'3',name:'Orbit launch',category:'Planned'},{id:'4',name:'Press "kit", Q4',category:'Completed'},{id:'5',name:'Tokyo 東京',category:'Planned'},{id:'6',name:'Notes\narchive',category:'Completed'}];
createRoot(document.getElementById('root')!).render(<main><header><span className="brand">✦ NORTHSTAR</span><span className="tag">SOURCE / REACT + TYPESCRIPT</span></header><div className="intro"><p className="eyebrow">COMPONENT STUDIO</p><h1>A table worth bringing along.</h1><p>Search, filter, sort and export — one working feature, three source files.</p></div><ProjectTable items={items}/><footer>FeatureGraft donor fixture · MIT · no account required</footer></main>);
