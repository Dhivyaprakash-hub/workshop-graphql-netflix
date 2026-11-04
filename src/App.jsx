import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { groupByGenre, loadSampleCatalog, movieKey, postCatalogRequest } from './data/catalog.js';

const SAVED_KEY = 'frame-watchlist-v1';

function readSaved() {
  try {
    const value = JSON.parse(window.localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function colorFor(genre = '') {
  let hash = 0;
  for (const character of genre) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return hash;
}

function MovieCard({ movie, onOpen, saved, onToggleSaved }) {
  return (
    <article className="movie-card">
      <button className="cover-art" style={{ '--cover-hue': colorFor(movie.genre) }} type="button" onClick={() => onOpen(movie)} aria-label={`Explore ${movie.title}`}>
        <span className="cover-orbit orbit-one" aria-hidden="true" />
        <span className="cover-orbit orbit-two" aria-hidden="true" />
        <span className="cover-kicker">FRAME / {movie.genre}</span>
        <span className="cover-title">{movie.title}</span>
        <span className="cover-edition">A FILM FOR YOUR NEXT EVENING</span>
        <span className="cover-open">EXPLORE ↗</span>
      </button>
      <div className="movie-meta"><div><strong>{movie.title}</strong><span>{movie.year || 'Year not listed'}{movie.duration ? ` · ${movie.duration} min` : ''}</span></div><button className={`save-button ${saved ? 'saved' : ''}`} type="button" onClick={() => onToggleSaved(movie)} aria-pressed={saved} aria-label={`${saved ? 'Remove' : 'Add'} ${movie.title} ${saved ? 'from' : 'to'} your watchlist`}>{saved ? '♥' : '♡'}</button></div>
    </article>
  );
}

function GenreRow({ genre, movies, watchlist, onOpen, onToggleSaved }) {
  const rail = useRef(null);
  return (
    <section className="genre-section" aria-labelledby={`genre-${colorFor(genre)}`}>
      <div className="genre-heading"><div><p className="eyebrow">A LITTLE OF WHAT YOU LOVE</p><h2 id={`genre-${colorFor(genre)}`}>{genre}<span> / {String(movies.length).padStart(2, '0')}</span></h2></div><div className="rail-controls"><button type="button" onClick={() => rail.current?.scrollBy({ left: -360, behavior: 'smooth' })} aria-label={`Scroll ${genre} titles left`}>←</button><button type="button" onClick={() => rail.current?.scrollBy({ left: 360, behavior: 'smooth' })} aria-label={`Scroll ${genre} titles right`}>→</button></div></div>
      <div className="movie-rail" ref={rail} role="list" aria-label={`${genre} films`}>
        {movies.map((movie) => <div className="rail-item" role="listitem" key={movieKey(movie)}><MovieCard movie={movie} onOpen={onOpen} saved={watchlist.includes(movieKey(movie))} onToggleSaved={onToggleSaved} /></div>)}
      </div>
    </section>
  );
}

function MovieDialog({ movie, saved, onClose, onToggleSaved }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (movie && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!movie && dialog.current?.open) dialog.current.close();
  }, [movie]);
  if (!movie) return <dialog className="movie-dialog" ref={dialog} />;
  const isSaved = saved.includes(movieKey(movie));
  return (
    <dialog className="movie-dialog" ref={dialog} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialog.current) onClose(); }} aria-labelledby="movie-dialog-title">
      <div className="dialog-art" style={{ '--cover-hue': colorFor(movie.genre) }}><span className="dialog-mark">F</span><button className="dialog-close" type="button" onClick={onClose} aria-label="Close film details">×</button><span className="dialog-art-label">FRAME / FILM INDEX</span></div>
      <div className="dialog-content"><p className="eyebrow">{movie.genre} {movie.year ? `· ${movie.year}` : ''}</p><h2 id="movie-dialog-title">{movie.title}</h2><p className="dialog-facts">{movie.duration ? `${movie.duration} minute runtime` : 'Runtime not listed'} <span>·</span> Catalog entry</p><p className="dialog-synopsis">{movie.synopsis || 'No synopsis is available in this catalog entry.'}</p><div className="dialog-actions"><button className="primary-action" type="button" onClick={() => onToggleSaved(movie)}>{isSaved ? 'Saved to your list' : 'Add to my list'} <span>{isSaved ? '♥' : '＋'}</span></button><button className="quiet-action" type="button" onClick={onClose}>Back to discovery</button></div><p className="dialog-note">Catalog details are educational sample data. This project does not stream films.</p></div>
    </dialog>
  );
}

function App() {
  const [movies, setMovies] = useState([]);
  const [watchlist, setWatchlist] = useState(readSaved);
  const [search, setSearch] = useState('');
  const [activeGenre, setActiveGenre] = useState('All films');
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [selected, setSelected] = useState(null);
  const [dataSource, setDataSource] = useState('sample');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(watchlist)); } catch { /* Keep this session usable if browser storage is blocked. */ }
  }, [watchlist]);

  useEffect(() => {
    const controller = new AbortController();
    async function initialize() {
      setLoading(true);
      setLoadError('');
      try {
        const sample = await loadSampleCatalog(controller.signal);
        if (controller.signal.aborted) return;
        setMovies(sample);
        setDataSource('sample');
        setLoading(false);

        try {
          const result = await postCatalogRequest('getGenres', { limit: 20 }, controller.signal);
          const genres = Array.isArray(result?.genres) ? result.genres.slice(0, 8) : [];
          if (!genres.length) return;
          const results = await Promise.allSettled(genres.map((genre) => postCatalogRequest('getMovies', { genre, pageState: null }, controller.signal)));
          const liveMovies = results.flatMap((item) => item.status === 'fulfilled' && Array.isArray(item.value?.movies) ? item.value.movies : []);
          if (!controller.signal.aborted && liveMovies.length) {
            setMovies(liveMovies);
            setDataSource('live');
          }
        } catch {
          // The bundled catalog remains available when Astra credentials are not configured.
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error.message || 'The catalog could not be opened.');
          setLoading(false);
        }
      }
    }
    initialize();
    return () => controller.abort();
  }, []);

  const visibleMovies = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return movies.filter((movie) => {
      const matchesSearch = !query || `${movie.title} ${movie.genre} ${movie.synopsis}`.toLocaleLowerCase().includes(query);
      const matchesGenre = activeGenre === 'All films' || movie.genre === activeGenre;
      const matchesList = !showWatchlist || watchlist.includes(movieKey(movie));
      return matchesSearch && matchesGenre && matchesList;
    });
  }, [activeGenre, movies, search, showWatchlist, watchlist]);
  const groups = useMemo(() => groupByGenre(visibleMovies), [visibleMovies]);
  const genres = useMemo(() => [...new Set(movies.map((movie) => movie.genre))], [movies]);
  const featured = visibleMovies[0];

  const toggleSaved = (movie) => {
    const key = movieKey(movie);
    setWatchlist((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const retryLoad = () => window.location.reload();

  return (
    <div className="frame-app">
      <header className="site-header"><a className="wordmark" href="#top" aria-label="FRAME home"><span className="wordmark-icon">F</span><span>FRAME<span className="wordmark-period">.</span></span></a><nav className="main-nav" aria-label="Main navigation"><button className={!showWatchlist ? 'active' : ''} type="button" onClick={() => setShowWatchlist(false)}>Discover</button><button className={showWatchlist ? 'active' : ''} type="button" onClick={() => setShowWatchlist(true)}>My list <span className="watchlist-count">{watchlist.length}</span></button></nav><div className="header-actions"><label className="header-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search films" aria-label="Search the film catalog" /><kbd>⌘ K</kbd></label><span className={`source-indicator ${dataSource === 'live' ? 'source-live' : ''}`}><i></i>{dataSource === 'live' ? 'GRAPHQL LIVE' : 'SAMPLE LIBRARY'}</span></div></header>
      <main id="top">
        <section className="hero-feature" aria-labelledby="hero-title"><div className="hero-visual" style={{ '--cover-hue': featured ? colorFor(featured.genre) : 212 }}><div className="hero-halo"></div><span className="hero-index">FRAME / FEATURED ENTRY</span><span className="hero-index-right">{featured?.year || 'CATALOG'} <i>✳</i></span><div className="hero-poster-letter" aria-hidden="true">{featured?.title?.charAt(0) || 'F'}</div><div className="hero-grid-mark" aria-hidden="true">FRAME<br />/ INDEX<br />001—020</div></div><div className="hero-copy"><p className="eyebrow"><span></span> THE EVENING EDIT <span className="eyebrow-line"></span></p><p className="hero-kicker">A GOOD FILM FINDS YOU.</p><h1 id="hero-title">{featured?.title || (loading ? 'Finding your next film…' : 'Room for a new story.')}</h1><p className="hero-description">{featured?.synopsis || 'Browse a thoughtful collection of films, find a genre you love, and keep a list for later.'}</p><div className="hero-details"><span>{featured?.genre || 'FILM DISCOVERY'}</span><i></i><span>{featured?.year || 'CURATED COLLECTION'}</span>{featured?.duration ? <><i></i><span>{featured.duration} MIN</span></> : null}</div><div className="hero-actions"><button className="hero-primary" type="button" onClick={() => featured && setSelected(featured)} disabled={!featured}>Explore title <span>↗</span></button>{featured ? <button className="hero-secondary" type="button" onClick={() => toggleSaved(featured)}>{watchlist.includes(movieKey(featured)) ? '♥ On my list' : '＋ Add to my list'}</button> : null}</div><div className="hero-caption"><span>01</span><span>—</span><span>DISCOVERY STARTS HERE</span></div></div></section>

        <section className="discovery-section" aria-labelledby="discovery-title"><div className="discovery-top"><div><p className="eyebrow">01 / THE COLLECTION</p><h2 id="discovery-title">Find your <em>next favourite.</em></h2></div><span className="collection-count">{visibleMovies.length} TITLES <i>·</i> {groups.length} GENRES</span></div><div className="genre-filters" role="group" aria-label="Filter by genre"><button className={activeGenre === 'All films' ? 'selected' : ''} type="button" onClick={() => setActiveGenre('All films')}>Everything</button>{genres.map((genre) => <button className={activeGenre === genre ? 'selected' : ''} type="button" key={genre} onClick={() => setActiveGenre(genre)}>{genre}</button>)}</div>
          {loading ? <div className="loading-state" role="status"><span className="loading-ring"></span><p>Setting the scene…</p></div> : null}
          {loadError ? <div className="error-state" role="alert"><span>!</span><div><strong>Couldn’t open the catalog.</strong><p>{loadError}</p><button type="button" onClick={retryLoad}>Try again ↗</button></div></div> : null}
          {!loading && !loadError && !groups.length ? <div className="empty-state"><span>✳</span><h3>{showWatchlist ? 'Your list is taking shape.' : 'No films match that search.'}</h3><p>{showWatchlist ? 'Save a title from Discover and it will be waiting here.' : 'Try another title or genre to keep exploring.'}</p><button type="button" onClick={() => { setSearch(''); setActiveGenre('All films'); setShowWatchlist(false); }}>{showWatchlist ? 'Back to discovery ↗' : 'Clear filters ↗'}</button></div> : null}
          {!loading && !loadError ? groups.map(({ genre, titles }) => <GenreRow key={genre} genre={genre} movies={titles} watchlist={watchlist} onOpen={setSelected} onToggleSaved={toggleSaved} />) : null}
        </section>
        <section className="about-strip"><div><p className="eyebrow">02 / A NOTE ABOUT FRAME</p><h2>Film discovery,<br /><em>without the noise.</em></h2></div><p>FRAME is a film catalog learning project built around a small sample collection and an optional Astra DB GraphQL connection. It helps you explore titles and save a personal list. It does not stream or host films.</p><span className="about-stamp">F<br /><i>✳</i></span></section>
      </main>
      <footer className="site-footer"><a className="wordmark" href="#top"><span className="wordmark-icon">F</span><span>FRAME<span className="wordmark-period">.</span></span></a><span>FILM DISCOVERY · GRAPHQL LEARNING PROJECT</span><span>YOUR WATCHLIST STAYS IN THIS BROWSER</span></footer>
      <MovieDialog movie={selected} saved={watchlist} onClose={() => setSelected(null)} onToggleSaved={toggleSaved} />
    </div>
  );
}

export default App;
