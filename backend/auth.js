import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config();
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
export const hashPassword = password => bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 12));
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);
export function signAccessToken(user, sessionId) {
 return jwt.sign({sub:user.id, sid:sessionId}, secret, {expiresIn:'2h', algorithm:'HS256'});
}
export function verifyAccessToken(token) { return jwt.verify(token,secret,{algorithms:['HS256']}); }
export async function createSession(client,user) {
 const id=randomUUID();
 await client.query(`insert into auth_sessions(id,user_id,expires_at) values($1,$2,now()+interval '2 hours')`,[id,user.id]);
 return signAccessToken(user,id);
}
