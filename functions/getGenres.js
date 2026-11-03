const fetch = require('node-fetch')

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: { Allow: 'POST' }, body: 'Method not allowed' }
  let limit
  try { limit = JSON.parse(event.body || 'null') } catch { return { statusCode: 400, body: 'Invalid request body' } }
  if (!Number.isInteger(limit) || limit < 1 || limit > 40) return { statusCode: 400, body: 'Limit must be between 1 and 40' }

  const url = process.env.ASTRA_GRAPHQL_ENDPOINT
  const token = process.env.ASTRA_DB_APPLICATION_TOKEN
  if (!url || !token) return { statusCode: 503, body: 'Catalog service is not configured' }
  const query = `
    query getAllGenres {
      reference_list (
        value: { label: "genre"},
      options: { limit: ${limit} }
      ) {
        values {
          value
        }
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
