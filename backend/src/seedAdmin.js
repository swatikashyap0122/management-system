import 'dotenv/config'
import bcrypt from 'bcryptjs'
import pool from './db.js'

const name = (process.env.ADMIN_NAME || '').trim()
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD || ''

if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 72) {
  throw new Error('Set ADMIN_NAME, a valid ADMIN_EMAIL, and an ADMIN_PASSWORD of 12-72 characters in backend/.env.')
}

try {
  const [existing] = await pool.execute('SELECT id, role FROM users WHERE email = ? LIMIT 1', [email])
  if (existing.length) {
    if (existing[0].role !== 'admin') {
      throw new Error('That email belongs to a student. Choose a different ADMIN_EMAIL.')
    }
    console.log(`Admin account ${email} already exists; its password was not changed.`)
  } else {
    const hash = await bcrypt.hash(password, 12)
    await pool.execute(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, 'admin'],
    )
    console.log(`Admin account ${email} created. Keep the configured password private.`)
  }
} finally {
  await pool.end()
}
