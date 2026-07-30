import { config } from 'dotenv';
import { isAbsolute, resolve } from 'node:path';

// 必须最先执行：JwtModule.register 在 import 期就要读 env。
config({ path: resolve(__dirname, '../.env') });

// SQLite 的 file:./<db> 在运行时按进程 cwd 解析，而 migrate/seed 按 schema 目录(prisma/)解析。
// 这里把相对路径锚定到 prisma 目录，使运行时与迁移用同一个文件，不受启动 cwd 影响。
const dbUrl = process.env.DATABASE_URL;
if (dbUrl?.startsWith('file:')) {
  const rel = dbUrl.slice('file:'.length);
  if (!isAbsolute(rel)) {
    process.env.DATABASE_URL = 'file:' + resolve(__dirname, '..', 'prisma', rel);
  }
}
