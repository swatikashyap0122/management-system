import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import pool from '../db.js'
import { httpError } from '../validation.js'

const router = Router()
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
})

function createSession(user) {
  const token = jwt.sign(
    { sub: String(user.id), role: user.role, name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '12h' },
  )
  return {
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      student_id: user.student_id,
      role: user.role,
    },
  }
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      throw httpError(400, 'Registration details must be sent as a JSON object.')
    }
    const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : ''
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const studentId = typeof req.body.studentId === 'string' ? req.body.studentId.trim() : ''
    const password = typeof req.body.password === 'string' ? req.body.password : ''

    if (fullName.length < 2 || fullName.length > 120) throw httpError(400, 'Enter a name between 2 and 120 characters.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw httpError(400, 'Enter a valid college email address.')
    if (studentId.length < 2 || studentId.length > 60) throw httpError(400, 'Enter a valid student ID.')
    if (password.length < 8 || password.length > 72) throw httpError(400, 'Password must be between 8 and 72 characters.')

    const passwordHash = await bcrypt.hash(password, 12)
    const [result] = await pool.execute(
      'INSERT INTO users (full_name, email, student_id, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [fullName, email, studentId, passwordHash, 'student'],
    )
    const user = { id: result.insertId, full_name: fullName, email, student_id: studentId, role: 'student' }
    return res.status(201).json(createSession(user))
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return next(httpError(409, 'That email or student ID is already registered.'))
    return next(error)
  }
})

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      throw httpError(400, 'Login details must be sent as a JSON object.')
    }
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body.password === 'string' ? req.body.password : ''
    const requestedRole = req.body.role === 'admin' ? 'admin' : 'student'
    if (!email || !password) throw httpError(400, 'Enter your email and password.')

    const [rows] = await pool.execute(
      'SELECT id, full_name, email, student_id, password_hash, role FROM users WHERE email = ? LIMIT 1',
      [email],
    )
    const user = rows[0]
    const matches = user && await bcrypt.compare(password, user.password_hash)
    if (!matches || user.role !== requestedRole) throw httpError(401, 'Email or password is incorrect.')
    return res.json(createSession(user))
  } catch (error) {
    return next(error)
  }
})

export default router
