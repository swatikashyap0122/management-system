import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import pool from './db.js'
import authRoutes from './routes/auth.js'
import eventRoutes from './routes/events.js'
import registrationRoutes from './routes/registrations.js'

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.')
}

const app = express()
const port = Number(process.env.PORT || 5000)
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())

app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('This website origin is not allowed by the API.'))
  },
}))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/events', eventRoutes)
app.use('/api', registrationRoutes)

app.use((req, res) => res.status(404).json({ message: 'That API endpoint was not found.' }))

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must contain valid JSON.' })
  }
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500
  if (status === 500) console.error(`[api] ${req.method} ${req.originalUrl}`, error)
  return res.status(status).json({
    message: status === 500 ? 'The server could not complete your request.' : error.message,
  })
})

try {
  await pool.query('SELECT 1')
  app.listen(port, () => {
    console.log(`Campusly API listening on http://localhost:${port}`)
  })
} catch (error) {
  console.error('Could not connect to MySQL. Check backend/.env and run backend/database/schema.sql.', error)
  process.exitCode = 1
}
