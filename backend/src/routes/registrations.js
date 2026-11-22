import { Router } from 'express'
import pool from '../db.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { httpError, validId } from '../validation.js'

const router = Router()

router.get('/registrations/mine', authenticate, requireRole('student'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.id, r.event_id, r.registered_at,
              e.title, e.category, e.description, e.event_date, e.location,
              e.capacity, e.image_url,
              (SELECT COUNT(*) FROM registrations all_r WHERE all_r.event_id = e.id) AS registration_count
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       WHERE r.user_id = ?
       ORDER BY e.event_date ASC`,
      [req.user.sub],
    )
    return res.json(rows.map((row) => ({
      id: row.id,
      event_id: row.event_id,
      registered_at: row.registered_at,
      event: {
        id: row.event_id,
        title: row.title,
        category: row.category,
        description: row.description,
        event_date: row.event_date,
        location: row.location,
        capacity: row.capacity,
        image_url: row.image_url,
        registration_count: row.registration_count,
      },
    })))
  } catch (error) {
    return next(error)
  }
})

router.get('/admin/registrations', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.id, r.registered_at, u.full_name AS student_name, u.email,
              u.student_id, e.title AS event_title, e.location AS event_location
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       JOIN events e ON e.id = r.event_id
       ORDER BY r.registered_at DESC`,
    )
    return res.json(rows)
  } catch (error) {
    return next(error)
  }
})

router.delete('/admin/registrations/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) throw httpError(400, 'Invalid registration ID.')
    const [result] = await pool.execute('DELETE FROM registrations WHERE id = ?', [req.params.id])
    if (!result.affectedRows) throw httpError(404, 'Registration not found.')
    return res.json({ message: 'Registration removed.' })
  } catch (error) {
    return next(error)
  }
})

export default router
