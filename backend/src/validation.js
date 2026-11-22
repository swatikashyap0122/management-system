export function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

export function validId(value) {
  const numericId = Number(value)
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(numericId) && numericId > 0
}

export function validateEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'Event details must be sent as a JSON object.')
  }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const location = typeof body.location === 'string' ? body.location.trim() : ''
  const eventDate = new Date(body.eventDate)
  const capacity = Number(body.capacity)
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
  const categories = ['Technology', 'Arts & culture', 'Career', 'Sports']

  if (title.length < 3 || title.length > 120) throw httpError(400, 'Event name must be between 3 and 120 characters.')
  if (!categories.includes(body.category)) throw httpError(400, 'Choose a valid event category.')
  if (description.length < 10 || description.length > 2000) throw httpError(400, 'Description must be between 10 and 2,000 characters.')
  if (Number.isNaN(eventDate.getTime()) || eventDate <= new Date()) throw httpError(400, 'Choose a valid future date and time.')
  if (location.length < 2 || location.length > 180) throw httpError(400, 'Location must be between 2 and 180 characters.')
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 100000) throw httpError(400, 'Capacity must be a whole number between 1 and 100,000.')
  if (imageUrl) {
    let parsedImageUrl
    try {
      parsedImageUrl = new URL(imageUrl)
    } catch {
      throw httpError(400, 'Cover image must be a valid http or https URL.')
    }
    if (!['http:', 'https:'].includes(parsedImageUrl.protocol) || imageUrl.length > 2048) {
      throw httpError(400, 'Cover image must be a valid http or https URL.')
    }
  }

  return {
    title,
    category: body.category,
    description,
    eventDate: eventDate.toISOString().slice(0, 19).replace('T', ' '),
    location,
    capacity,
    imageUrl: imageUrl || null,
  }
}
