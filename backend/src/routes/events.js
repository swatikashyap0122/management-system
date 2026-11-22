import { Router } from 'express'
import pool from '../db.js'
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth.js'
import { httpError, validId, validateEvent } from '../validation.js'

const router = Router()

const eventSelect = `
  SELECT e.id, e.title, e.category, e.description, e.event_date, e.location,
         e.capacity, e.image_url, e.created_at, COUNT(r.id) AS registration_count
  FROM events e
  LEFT JOIN registrations r ON r.event_id = e.id
`

router.get('/', optionalAuthenticate, async (req, res, next) => {
  try {
    const upcomingOnly = req.user?.role !== 'admin'
    const [events] = await pool.execute(
      `${eventSelect}
       ${upcomingOnly ? 'WHERE e.event_date >= UTC_TIMESTAMP()' : ''}
       GROUP BY e.id
       ORDER BY e.event_date ASC`,
    )
    return res.json(events)
  } catch (error) {
    return next(error)
  }
})

router.get('/:id', optionalAuthenticate, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) throw httpError(400, 'Invalid event ID.')
    const [events] = await pool.execute(
      `${eventSelect}
       WHERE e.id = ?
       GROUP BY e.id`,
      [req.params.id],
    )
    if (!events.length) throw httpError(404, 'Event not found.')
    return res.json(events[0])
  } catch (error) {
    return next(error)
  }
})

router.post('/:id/register', authenticate, requireRole('student'), async (req, res, next) => {
  let connection
  let transactionStarted = false
  try {
    if (!validId(req.params.id)) throw httpError(400, 'Invalid event ID.')
    connection = await pool.getConnection()
    await connection.beginTransaction()
    transactionStarted = true

    const [events] = await connection.execute(
      'SELECT id, capacity, event_date FROM events WHERE id = ? FOR UPDATE',
      [req.params.id],
    )
    const event = events[0]
    if (!event) throw httpError(404, 'Event not found.')
    if (new Date(event.event_date) <= new Date()) throw httpError(409, 'This event has already taken place.')

    const [existing] = await connection.execute(
      'SELECT id FROM registrations WHERE user_id = ? AND event_id = ? LIMIT 1',
      [req.user.sub, req.params.id],
    )
    if (existing.length) throw httpError(409, 'You are already registered for this event.')

    const [[{ registered }]] = await connection.execute(
      'SELECT COUNT(*) AS registered FROM registrations WHERE event_id = ?',
      [req.params.id],
    )
    if (Number(registered) >= Number(event.capacity)) throw httpError(409, 'Sorry, this event is full.')

    await connection.execute(
      'INSERT INTO registrations (user_id, event_id) VALUES (?, ?)',
      [req.user.sub, req.params.id],
    )
    await connection.commit()
    transactionStarted = false
    return res.status(201).json({ message: 'You are registered for this event.' })
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    if (error.code === 'ER_DUP_ENTRY') return next(httpError(409, 'You are already registered for this event.'))
    return next(error)
  } finally {
    if (connection) connection.release()
  }
})

router.post('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const event = validateEvent(req.body)
    const [result] = await pool.execute(
      `INSERT INTO events
       (title, category, description, event_date, location, capacity, image_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [event.title, event.category, event.description, event.eventDate, event.location, event.capacity, event.imageUrl, req.user.sub],
    )
    return res.status(201).json({ id: result.insertId, message: 'Event created.' })
  } catch (error) {
    return next(error)
  }
})

router.put('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  let connection
  let transactionStarted = false
  try {
    if (!validId(req.params.id)) throw httpError(400, 'Invalid event ID.')
    const event = validateEvent(req.body)
    connection = await pool.getConnection()
    await connection.beginTransaction()
    transactionStarted = true
    const [existing] = await connection.execute(
      'SELECT id FROM events WHERE id = ? FOR UPDATE',
      [req.params.id],
    )
    if (!existing.length) throw httpError(404, 'Event not found.')
    const [[{ registered }]] = await connection.execute(
      'SELECT COUNT(*) AS registered FROM registrations WHERE event_id = ?',
      [req.params.id],
    )
    if (event.capacity < Number(registered)) {
      throw httpError(409, `Capacity cannot be lower than the ${registered} current registrations.`)
    }
    await connection.execute(
      `UPDATE events
       SET title = ?, category = ?, description = ?, event_date = ?, location = ?, capacity = ?, image_url = ?
       WHERE id = ?`,
      [event.title, event.category, event.description, event.eventDate, event.location, event.capacity, event.imageUrl, req.params.id],
    )
    await connection.commit()
    transactionStarted = false
    return res.json({ message: 'Event updated.' })
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    return next(error)
  } finally {
    if (connection) connection.release()
  }
})

router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) throw httpError(400, 'Invalid event ID.')
    const [result] = await pool.execute('DELETE FROM events WHERE id = ?', [req.params.id])
    if (!result.affectedRows) throw httpError(404, 'Event not found.')
    return res.json({ message: 'Event and its registrations deleted.' })
  } catch (error) {
    return next(error)
  }
})

export default router
