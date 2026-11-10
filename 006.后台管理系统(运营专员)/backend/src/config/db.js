import mysql from 'mysql2/promise';
import { config } from './env.js';

export const pool = mysql.createPool({
  ...config.db,
  charset: 'utf8mb4',
  timezone: '+08:00',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  decimalNumbers: true,
});

pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+08:00'");
});

/** 后台只读查询：本文件不提供任何写操作封装。 */
export async function query(sql, params = []) {
  if (!/^\s*select\s/i.test(sql)) {
    throw new Error('后台管理系统只允许 SELECT 查询');
  }
  const [rows] = await pool.execute(sql, params);
  return rows;
}
