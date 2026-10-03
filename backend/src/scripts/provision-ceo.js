// One-time private operator command. Does not print or store the password.
import 'dotenv/config';
import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {pool} from '../src/lib/db.js';
import {hashPassword} from '../src/lib/auth.js';
const rl=createInterface({input,output});
let client;
try {
 const email=(await rl.question('CEO email: ')).trim().toLowerCase();
 const fullName=(await rl.question('CEO full name: ')).trim();
 // Supply password securely through CEO_INITIAL_PASSWORD environment variable.
 const password=process.env.CEO_INITIAL_PASSWORD;
 if(!email.includes('@') || fullName.length<2 || !password || password.length<16)
  throw new Error('Valid email/name and CEO_INITIAL_PASSWORD of at least 16 characters required');
 client=await pool.connect();await client.query('BEGIN');
 const exists=await client.query(`select 1 from user_roles ur join roles r on r.id=ur.role_id where r.code='ceo' limit 1`);
 if(exists.rowCount) throw new Error('CEO already provisioned. Aborting.');
 const hash=await hashPassword(password);
 const u=await client.query(`insert into users(email,full_name,password_hash) values($1,$2,$3) returning id`,[email,fullName,hash]);
 const a=await client.query(`insert into user_roles(user_id,role_id) select $1,id from roles where code='ceo' returning user_id`,[u.rows[0].id]);
 if(a.rowCount!==1) throw new Error('CEO role missing');
 await client.query(`insert into audit_logs(actor_user_id,action,entity_type,entity_id) values($1,'ceo.provision','user',$1)`,[u.rows[0].id]);
 await client.query('COMMIT');output.write('CEO provisioned successfully.\n');
} catch(e){if(client) await client.query('ROLLBACK').catch(()=>{});output.write('Provisioning failed: '+e.message+'\n');process.exitCode=1;}
finally {rl.close();if(client)client.release();await pool.end();}
