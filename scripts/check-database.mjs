import mysql from 'mysql2/promise'

const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
const missing = required.filter(name => !process.env[name])
if (missing.length) {
  console.error('缺少数据库配置：' + missing.join(', '))
  process.exit(1)
}

let connection
try {
  connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    connectTimeout: 10000,
  })
  await connection.query('SELECT 1')
  const [rows] = await connection.execute(
    'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    ['portfolio_content'],
  )
  console.log('数据库登录与只读查询成功。')
  console.log(rows[0].count > 0 ? '内容表已存在。' : '内容表尚未创建，将在后端首次正常启动时初始化。')
} catch (error) {
  console.error('数据库检查失败：' + (error.code || error.name))
  process.exitCode = 1
} finally {
  if (connection) await connection.end()
}
