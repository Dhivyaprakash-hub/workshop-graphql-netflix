const response = (statusCode, payload) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': statusCode === 200 ? 'public, max-age=30, stale-while-revalidate=60' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
  body: JSON.stringify(payload),
});

function providerConfig() {
  const endpoint = process.env.ASTRA_GRAPHQL_ENDPOINT;
  const token = process.env.ASTRA_DB_APPLICATION_TOKEN;
  if (!endpoint || !token) return null;
  try {
    if (new URL(endpoint).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return { endpoint, token };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed.' });
  if (!event.body || event.body.length > 1024) return response(400, { error: 'Invalid request body.' });

  let body;
  try { body = JSON.parse(event.body); } catch { return response(400, { error: 'Invalid request body.' }); }
  const limit = body?.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    return response(400, { error: 'Limit must be an integer from 1 to 20.' });
  }

  const config = providerConfig();
  if (!config) return response(503, { error: 'Live catalog is not configured.' });

  const query = `
    query GetGenres($limit: Int!) {
      reference_list(value: { label: "genre" }, options: { limit: $limit }) {
        values { value }
      }
    }
  `;

  try {
    const upstream = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cassandra-token': config.token },
      body: JSON.stringify({ query, variables: { limit } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) return response(502, { error: 'Live catalog provider is unavailable.' });
    const result = await upstream.json();
    if (result.errors?.length || !Array.isArray(result.data?.reference_list?.values)) {
      return response(502, { error: 'Live catalog returned an unexpected response.' });
    }
    const genres = [...new Set(result.data.reference_list.values
      .map((item) => item?.value)
      .filter((value) => typeof value === 'string' && value.length <= 50))];
    return response(200, { genres });
  } catch {
    return response(502, { error: 'Live catalog request failed.' });
  }
};
