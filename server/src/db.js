// PHMP - قاعدة البيانات المحلية SQLite
// إدارة المخطط + التهيئة + الاستعلامات المشتركة
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

export const DB_PATH = process.env.PHMP_DB_PATH
  ? path.resolve(process.env.PHMP_DB_PATH)
  : path.join(DATA_DIR, 'phmp.db')

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ===== إنشاء المخطط =====
export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pharmacies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nameEn TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      license TEXT,
      logo TEXT DEFAULT '💊',
      color TEXT DEFAULT 'blue',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      nameEn TEXT,
      role TEXT NOT NULL CHECK (role IN ('super_admin','admin','accountant','pharmacist','cashier')),
      pharmacy_id TEXT REFERENCES pharmacies(id),
      avatar TEXT DEFAULT '👤',
      active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      code TEXT,
      barcode TEXT,
      name TEXT NOT NULL,
      nameEn TEXT, nameFr TEXT,
      dci TEXT, dosage TEXT, form TEXT, presentation TEXT,
      sku TEXT, manufacturer TEXT, category TEXT,
      cost REAL DEFAULT 0, price REAL DEFAULT 0, ppv REAL, prixBR REAL,
      stock INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 10,
      expiry TEXT, batch TEXT,
      requires_prescription INTEGER DEFAULT 0,
      taux_remboursement TEXT DEFAULT '0%',
      princeps_generique TEXT,
      pharmacy_id TEXT REFERENCES pharmacies(id),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL, phone TEXT, email TEXT, address TEXT,
      loyalty_points INTEGER DEFAULT 0,
      total_purchases REAL DEFAULT 0,
      last_visit TEXT,
      pharmacy_id TEXT REFERENCES pharmacies(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL, contact_name TEXT, phone TEXT, email TEXT, address TEXT,
      pharmacy_id TEXT REFERENCES pharmacies(id)
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      customer_name TEXT, doctor TEXT, date TEXT, status TEXT DEFAULT 'pending',
      medications TEXT, notes TEXT,
      pharmacy_id TEXT REFERENCES pharmacies(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      customer_id TEXT, customer_name TEXT,
      user_id TEXT, user_name TEXT,
      subtotal REAL, discount REAL DEFAULT 0, total REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      amount_paid REAL, change REAL,
      items TEXT NOT NULL,
      pharmacy_id TEXT REFERENCES pharmacies(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      user_id TEXT, user_name TEXT, user_role TEXT,
      action TEXT NOT NULL,
      details TEXT,
      pharmacy_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(timestamp);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
}

export function setMeta(key, value) {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value))
}

export function getMeta(key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key)
  return row?.value || null
}
