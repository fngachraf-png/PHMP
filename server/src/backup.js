// PHMP — نسخة احتياطية ذرّية لقاعدة SQLite (VACUUM INTO) + تحقق + احتفاظ
// يُشغَّل يومياً من cron عبر server/scripts/backup.sh
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import { db, DB_PATH } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups')
const KEEP = 30

fs.mkdirSync(BACKUP_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const target = path.join(BACKUP_DIR, `phmp-${stamp}.db`)

db.prepare('VACUUM INTO ?').run(target)

// تحقق من سلامة اللقطة نفسها
const snap = new Database(target, { readonly: true })
const qc = snap.prepare('PRAGMA quick_check').get().quick_check
const tables = snap.prepare("SELECT count(*) c FROM sqlite_master WHERE type='table'").get().c
snap.close()

if (qc !== 'ok') {
  console.error(`❌ نسخة تالفة: ${target} (quick_check=${qc})`)
  process.exit(1)
}

// احتفاظ بآخر 30 نسخة
const files = fs.readdirSync(BACKUP_DIR)
  .filter((f) => f.startsWith('phmp-') && f.endsWith('.db'))
  .sort()
for (const old of files.slice(0, Math.max(0, files.length - KEEP))) {
  fs.unlinkSync(path.join(BACKUP_DIR, old))
}

const size = fs.statSync(target).size
console.log(`${new Date().toISOString()} ok ${path.basename(target)} ${size}B tables=${tables} quick_check=${qc} source=${DB_PATH}`)
db.close()
