// FAQAT lokal sinov uchun (commit qilinmaydi): worktree'da .env bo'lmagani uchun
// test qiymatlar bilan `next dev`ni ishga tushiradi. Mavjud env ustun turadi.
import { spawn } from "node:child_process";

process.env.DATABASE_URL ??= "file:./prisma/dev.db";
process.env.SESSION_SECRET ??= "worktree_test_secret_kamida_32_belgidan_iborat_123456";
process.env.TELEGRAM_BOT_TOKEN ??= "0:test_token_lokal_sinov";

const child = spawn("npx", ["next", "dev"], { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
