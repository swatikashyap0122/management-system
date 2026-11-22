import 'dotenv/config'
import pool from './db.js'

const dayFromNow = (days, hour) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

const samples = [
  {
    title: 'Build Night: Make Something Real',
    category: 'Technology',
    description: 'Bring an idea, meet a team, and spend an evening building a small project you can actually show off. All skill levels welcome.',
    eventDate: dayFromNow(5, 17),
    location: 'Innovation Lab',
    capacity: 80,
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85',
  },
  {
    title: 'The Courtyard Sessions',
    category: 'Arts & culture',
    description: 'An easygoing evening of live music, student art, and good company. Bring a friend or come meet someone new.',
    eventDate: dayFromNow(9, 18),
    location: 'North Courtyard',
    capacity: 120,
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1000&q=85',
  },
  {
    title: 'Your First Internship, Unpacked',
    category: 'Career',
    description: 'Get practical advice from recent graduates on applications, interviews, and finding a first role that fits.',
    eventDate: dayFromNow(14, 16),
    location: 'Business School · Room 204',
    capacity: 60,
    imageUrl: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=85',
  },
  {
    title: 'Campus Cup: Five-a-Side',
    category: 'Sports',
    description: 'Round up a team or join one at the field. A friendly five-a-side tournament with music, snacks, and plenty of sideline energy.',
    eventDate: dayFromNow(18, 15),
    location: 'East Sports Ground',
    capacity: 96,
    imageUrl: 'https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1000&q=85',
  },
]

try {
  const [admins] = await pool.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
  const adminId = admins[0]?.id || null
  let inserted = 0
  for (const event of samples) {
    const [existing] = await pool.execute('SELECT id FROM events WHERE title = ? LIMIT 1', [event.title])
    if (existing.length) continue
    await pool.execute(
      `INSERT INTO events
       (title, category, description, event_date, location, capacity, image_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [event.title, event.category, event.description, event.eventDate, event.location, event.capacity, event.imageUrl, adminId],
    )
    inserted += 1
  }
  console.log(`${inserted} sample event(s) added. Existing sample events were left unchanged.`)
} finally {
  await pool.end()
}
