const { db } = require('./src/firebase');
async function main(){
  const snaps = await db.collection('settings').listDocuments();
  const carryScopes = [];
  for(const ref of snaps){ const id=ref.id; if(id.startsWith('carryover_')) carryScopes.push(id.replace('carryover_','')); }
  console.log('=== 所有 carryover scope ===');
  for(const s of carryScopes){
    const c = await db.collection('settings').doc('carryover_'+s).get();
    const setSnap = await db.collection('settlements').where('userId','==',s).get();
    const yms = [];
    setSnap.forEach(d=>yms.push(d.data().yearMonth+':'+d.data().netAmount));
    console.log(s, 'carryover=', c.exists?c.data().amount:'(無)', 'settlements=', yms.join(', ')||'(無)');
  }
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1);});
