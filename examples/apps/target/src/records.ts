export interface WorkItem { key:string; project:string; client:string; stage:'Active'|'Planned'|'Completed'; budget:number; }
export const records:WorkItem[]=[
  {key:'w-1',project:'Atlas redesign',client:'Acme',stage:'Active',budget:2400},
  {key:'w-2',project:'Café storefront',client:'Atelier',stage:'Active',budget:1800},
  {key:'w-3',project:'Orbit launch',client:'Orbit',stage:'Planned',budget:900},
  {key:'w-4',project:'Press "kit", Q4',client:'Acme',stage:'Completed',budget:650},
  {key:'w-5',project:'Tokyo 東京',client:'Studio',stage:'Planned',budget:750},
  {key:'w-6',project:'Notes\narchive',client:'Internal',stage:'Completed',budget:100},
];
export const brand='Relay';
export const totalBudget=(items:WorkItem[])=>items.reduce((sum,item)=>sum+item.budget,0);
