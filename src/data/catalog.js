function parseCsvRow(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function parseCatalogCsv(source) {
  const lines = source.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const headers = parseCsvRow(lines.shift() || '');
  const expected = ['genre', 'title', 'thumbnail', 'year', 'synopsis', 'duration'];
  if (headers.join(',') !== expected.join(',')) throw new Error('The sample catalog has an unsupported CSV format.');

  return lines.map((line, index) => {
    const values = parseCsvRow(line);
    if (values.length !== expected.length) throw new Error(`Catalog row ${index + 2} has an unexpected number of fields.`);
    const [genre, title, thumbnail, year, synopsis, duration] = values;
    if (!genre || !title) return null;
    return {
      genre: genre.slice(0, 50),
      title: title.slice(0, 160),
      thumbnail: thumbnail.startsWith('https://') ? thumbnail : '',
      year: /^\d{4}$/.test(year) ? Number(year) : null,
      synopsis: synopsis.slice(0, 1200),
      duration: /^\d{1,3}$/.test(duration) ? Number(duration) : null,
    };
  }).filter(Boolean);
}

export async function loadSampleCatalog(signal) {
  const response = await fetch('/catalog.csv', { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error('The sample collection could not be loaded.');
  return parseCatalogCsv(await response.text());
}

export async function postCatalogRequest(path, payload, signal) {
  const response = await fetch(`/.netlify/functions/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'The live collection could not be loaded.');
  return body;
}

export function groupByGenre(movies) {
  const groups = new Map();
  for (const movie of movies) {
    if (!groups.has(movie.genre)) groups.set(movie.genre, []);
    groups.get(movie.genre).push(movie);
  }
  return [...groups.entries()].map(([genre, titles]) => ({ genre, titles }));
}

export function movieKey(movie) {
  return `${movie.title.toLocaleLowerCase()}::${movie.year ?? 'unknown'}::${movie.genre.toLocaleLowerCase()}`;
}
