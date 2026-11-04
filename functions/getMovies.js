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
  if (!event.body || event.body.length > 4096) return response(400, { error: 'Invalid request body.' });

  let body;
  try { body = JSON.parse(event.body); } catch { return response(400, { error: 'Invalid request body.' }); }
  const genre = body?.genre;
  const pageState = body?.pageState ?? null;
  if (typeof genre !== 'string' || !/^[\p{L}\p{N} &'’-]{1,50}$/u.test(genre)) {
    return response(400, { error: 'Invalid genre.' });
  }
  if (pageState !== null && (typeof pageState !== 'string' || pageState.length > 2048)) {
    return response(400, { error: 'Invalid page state.' });
  }

  const config = providerConfig();
  if (!config) return response(503, { error: 'Live catalog is not configured.' });

  const query = `
    query GetMoviesByGenre($genre: String!, $pageState: String) {
      movies_by_genre(
        value: { genre: $genre },
        orderBy: [year_DESC],
        options: { pageSize: 6, pageState: $pageState }
      ) {
        values { year title duration synopsis thumbnail }
        pageState
      }
    }
  `;

  try {
    const upstream = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cassandra-token': config.token },
      body: JSON.stringify({ query, variables: { genre, pageState } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) return response(502, { error: 'Live catalog provider is unavailable.' });
    const result = await upstream.json();
    const collection = result.data?.movies_by_genre;
    if (result.errors?.length || !Array.isArray(collection?.values)) {
      return response(502, { error: 'Live catalog returned an unexpected response.' });
    }
    const movies = collection.values
      .filter((movie) => movie && typeof movie.title === 'string')
      .map((movie) => ({
        title: movie.title.slice(0, 160),
        year: Number.isInteger(Number(movie.year)) ? Number(movie.year) : null,
        duration: Number.isInteger(Number(movie.duration)) ? Number(movie.duration) : null,
        synopsis: typeof movie.synopsis === 'string' ? movie.synopsis.slice(0, 1200) : '',
        thumbnail: typeof movie.thumbnail === 'string' && movie.thumbnail.startsWith('https://') ? movie.thumbnail : '',
        genre,
      }));
    const nextPageState = typeof collection.pageState === 'string' && collection.pageState.length <= 2048
      ? collection.pageState
      : null;
    return response(200, { movies, pageState: nextPageState });
  } catch {
    return response(502, { error: 'Live catalog request failed.' });
  }
};
