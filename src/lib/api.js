export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = auth ? localStorage.getItem('campus_token') : null
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new Error('Can’t reach the server. Check that the backend is running.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    if (!response.ok && response.status >= 500) {
      throw new Error('The server is unavailable. Check that the backend and MySQL are running.')
    }
    throw new Error('The server returned an invalid response. Please try again.')
  }
  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error('The server is unavailable. Check that the backend and MySQL are running.')
    }
    throw new Error(payload.message || 'Something went wrong. Please try again.')
  }
  return payload
}
