/**
 * VEB ilovasining HAQIQIY tokenlarini tekshiradi (src/app/globals.css).
 * iOS tokenlaridan alohida — bu yerda faqat mavjud veb qiymatlari.
 *   node design/render/veb-kontrast.mjs
 */
const L=(h)=>{const c=h.replace("#","");const v=[0,2,4].map(i=>{const s=parseInt(c.slice(i,i+2),16)/255;return s<=0.03928?s/12.92:((s+0.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
const R=(a,b)=>{const[x,y]=[L(a),L(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)};

const LIGHT={surface:"#FFFFFF",app:"#F1F5F9",fg:"#0F172A",fgMuted:"#475569",fgFaint:"#64748B",
  income:"#15803D",expense:"#DC2626",debt:"#B45309",warning:"#A16207",info:"#0369A1",brand:"#0F766E"};
const DARK={surface:"#0D211F",app:"#061413",fg:"#E2F0EE",fgMuted:"#94ACA8",fgFaint:"#7B9A95",
  income:"#4ADE80",expense:"#F87171",debt:"#FBBF24",warning:"#FBBF24",info:"#38BDF8",brand:"#2DD4BF"};

const J=[["fg","surface",4.5],["fgMuted","surface",4.5],["fgFaint","surface",4.5],
  ["income","surface",4.5],["expense","surface",4.5],["debt","surface",4.5],
  ["warning","surface",4.5],["info","surface",4.5],["brand","surface",4.5]];

let xato=0;
for(const [nom,T] of [["LIGHT",LIGHT],["DARK",DARK]]){
  console.log(`\n### ${nom}`);
  for(const [f,b,min] of J){
    const r=R(T[f],T[b]); const ok=r>=min; if(!ok)xato++;
    console.log(`  ${ok?"✅":"❌"}  ${f.padEnd(9)} ${T[f]}  ${r.toFixed(2)}:1  (talab ${min})`);
  }
}
console.log(`\n${xato} ta juft AA dan o'tmadi.`);
