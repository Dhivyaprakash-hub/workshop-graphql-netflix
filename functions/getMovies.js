const fetch = require('node-fetch')

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: { Allow: 'POST' }, body: 'Method not allowed' }
  let body
  try { body = JSON.parse(event.body || '{}') } catch { return { statusCode: 400, body: 'Invalid request body' } }
  const genre = body.genre
  const pageState = body.pageState
  if (typeof genre !== 'string' || !/^[\p{L}\p{N} &'-]{1,50}$/u.test(genre)) return { statusCode: 400, body: 'Invalid genre' }
  if (pageState != null && (typeof pageState !== 'string' || pageState.length > 2048)) return { statusCode: 400, body: 'Invalid page state' }
  const url = process.env.ASTRA_GRAPHQL_ENDPOINT
  const token = process.env.ASTRA_DB_APPLICATION_TOKEN
  if (!url || !token) return { statusCode: 503, body: 'Catalog service is not configured' }
  const query = `
  query {
    movies_by_genre (
      value: { genre: ${JSON.stringify(genre)}},
      orderBy: [year_DESC],
      options: { pageSize: 6, pageState: ${JSON.stringify(pageState)} }
    ) {
      values {
        year,
        title,
        duration,
        synopsis,
        thumbnail
      }
      pageState
    }
  }
  `  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "x-cassandra-token": token
    },
    body: JSON.stringify({ query })
  })

  if (!response.ok) return { statusCode: 502, body: 'Catalog provider request failed' }
  try { return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await response.json()) } }
  catch { return { statusCode: 502, body: 'Catalog provider returned invalid data' } }
}
