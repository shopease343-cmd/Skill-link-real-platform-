import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const required=[
  'backend/src/server.js','backend/src/middleware/auth.js',
  'backend/src/routes/auth.js','backend/src/routes/commerce.js',
  'backend/src/routes/partner.js','backend/src/routes/ceo.js',
  'backend/src/routes/notifications.js','backend/src/routes/rewards.js',
  'frontend/src/App.jsx','frontend/src/styles.css',
  'supabase/009_phase11_reconciliation.sql'
];
const failures=[];
for(const file of required){if(!fs.existsSync(path.join(root,file)))failures.push(`Missing: ${file}`)}
const forbidden=[/JWT_SECRET\s*=\s*['\"]/i,/DATABASE_URL\s*=\s*['\"]/i,/service_role/i,/RAZORPAY_KEY_SECRET\s*=\s*['\"]/i,/password\s*[:=]\s*['\"][^'\"]+['\"]/i];
for(const dir of ['backend/src','frontend/src']){
  const walk=(d)=>{for(const n of fs.readdirSync(d)){const p=path.join(d,n);const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(/\.(js|jsx|ts|tsx)$/.test(n)){const txt=fs.readFileSync(p,'utf8');for(const re of forbidden)if(re.test(txt))failures.push(`Potential secret in ${path.relative(root,p)}: ${re}`)}}};
  walk(path.join(root,dir));
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Phase 11 static security/file checks passed (${required.length} required files).`);
