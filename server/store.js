import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { contentSchema } from './schema.js'
import { demoContent } from '../src/data/content.js'
export async function createStore(env = process.env) {
  if (env.MYSQL_HOST) {
    if (!env.MYSQL_USER || !env.MYSQL_DATABASE) throw new Error('MYSQL_USER 和 MYSQL_DATABASE 为必填配置')
    const pool = mysql.createPool({ host: env.MYSQL_HOST, port: Number(env.MYSQL_PORT || 3306), user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DATABASE, connectionLimit: 5, charset: 'utf8mb4' })
    await pool.query('CREATE TABLE IF NOT EXISTS portfolio_content (id TINYINT PRIMARY KEY, document JSON NOT NULL, revision INT NOT NULL DEFAULT 1, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)')
    await pool.query('CREATE TABLE IF NOT EXISTS portfolio_media (id CHAR(36) PRIMARY KEY, mime VARCHAR(32) NOT NULL, data MEDIUMBLOB NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    // 并发创建容器时，只初始化缺失记录；绝不覆盖现有内容。
    await pool.execute('INSERT IGNORE INTO portfolio_content (id, document) VALUES (1, ?)', [JSON.stringify(contentSchema.parse(demoContent))])
    return {
      async read() { const [rows] = await pool.query('SELECT document, revision FROM portfolio_content WHERE id=1'); const raw = typeof rows[0].document === 'string' ? JSON.parse(rows[0].document) : rows[0].document; return { content: contentSchema.parse(raw), revision: rows[0].revision } },
      async write(content, expectedRevision) { const [result] = await pool.execute('UPDATE portfolio_content SET document=?, revision=revision+1 WHERE id=1 AND revision=?', [JSON.stringify(content), expectedRevision]); return result.affectedRows === 1 },
      async saveMedia(id, type, data) { await pool.execute('INSERT INTO portfolio_media (id,mime,data) VALUES (?,?,?)', [id,type,data]) },
      async readMedia(id) { const [rows] = await pool.execute('SELECT mime,data FROM portfolio_media WHERE id=?', [id]); return rows[0] ? { type: rows[0].mime, data: rows[0].data } : null },
      async close() { await pool.end() },
    }
  }
  if (env.NODE_ENV === 'production') throw new Error('生产环境必须配置 MySQL；容器本地文件不可作为持久化存储')
  const dir = path.resolve(env.DATA_DIR || 'server/data'), file = path.join(dir, 'content.json')
  await mkdir(dir, { recursive: true })
  let current
  try { current = JSON.parse(await readFile(file, 'utf8')); current.content = contentSchema.parse(current.content) }
  catch (error) { if (error.code !== 'ENOENT') throw error; current = { content: contentSchema.parse(demoContent), revision: 1 }; await writeFile(file, JSON.stringify(current), { mode: 0o600 }) }
  // 同一进程内串行写入，旧版本提交返回冲突。
  let queue = Promise.resolve()
  return {
    async read() { return structuredClone(current) },
    write(content, expectedRevision) { const action = queue.then(async () => { if (current.revision !== expectedRevision) return false; const next = { content, revision: current.revision + 1 }; await writeFile(file + '.tmp', JSON.stringify(next), { mode: 0o600 }); await rename(file + '.tmp', file); current = next; return true }); queue = action.catch(() => {}); return action },
    async saveMedia(id, type, data) { await mkdir(path.join(dir, 'media'), { recursive: true }); await writeFile(path.join(dir, 'media', id + '.json'), JSON.stringify({ type, data: data.toString('base64') }), { mode: 0o600 }) },
    async readMedia(id) { try { const value = JSON.parse(await readFile(path.join(dir, 'media', id + '.json'), 'utf8')); return { type: value.type, data: Buffer.from(value.data, 'base64') } } catch (error) { if (error.code === 'ENOENT') return null; throw error } },
    async close() { await queue },
  }
}
