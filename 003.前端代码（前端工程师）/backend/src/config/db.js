import mysql from 'mysql2/promise';
import { config } from './env.js';

export const pool = mysql.createPool({
  ...config.db,
  charset: 'utf8mb4',
  timezone: '+08:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
});

// 让 MySQL 的 NOW() / CURDATE() 也使用东八区，避免与本地时间相差 8 小时。
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+08:00'");
});

/** 查询多行，返回 rows */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** 执行 INSERT / UPDATE / DELETE，返回 result（含 insertId、affectedRows） */
export async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

/** 事务：回调里的 conn 使用 conn.execute，返回 [result, fields] */
export async function withTransaction(handler) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await handler(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function assertDbConnection() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT VERSION() AS version, DATABASE() AS db');
    return rows[0];
  } finally {
    conn.release();
  }
}
