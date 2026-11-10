import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const password = process.argv[2] || crypto.randomBytes(6).toString('base64url');

console.log('密码：', password);
console.log('bcrypt 哈希：', bcrypt.hashSync(password, 10));
console.log('\n把哈希写入 .env 的 ADMIN_PASSWORD_HASH');
