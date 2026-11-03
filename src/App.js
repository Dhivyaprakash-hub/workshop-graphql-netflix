import "./App.css"
import { useEffect, useState } from "react"
import Section from "./components/Section"
import HeroSection from "./components/HeroSection"
import NavBar from "./components/NavBar"

const App = () => {
  const genreIncrement = 4
  const [genres, setGenres] = useState(null)
  const [limit, setLimit] = useState(genreIncrement)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(true)

  const fetchData = async () => {
    if (loading || !hasMore) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch("/.netlify/functions/getGenres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(limit),
      })
      if (!response.ok) throw new Error('The catalog could not be loaded.')
      const responseBody = await response.json()
      const values = responseBody?.data?.reference_list?.values
      if (!Array.isArray(values)) throw new Error('The catalog returned an unexpected response.')
      setGenres(values)
      setHasMore(values.length === limit && limit < 40)
    } catch (requestError) {
      setError(requestError.message || 'The catalog could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit])

  return (
    <>
      <NavBar />
      <HeroSection />
      {genres && (
        <div className="container">
          {Object.values(genres).map((genre) => (
            <Section key={genre.value} genre={genre.value} />
          ))}
        </div>
      )}
      {error && <p role="alert">{error} <button onClick={fetchData}>Retry</button></p>}
      {hasMore && <button className="page-end" disabled={loading} onClick={() => setLimit(value => Math.min(value + genreIncrement, 40))}>
        {loading ? 'Loading…' : 'Load more genres'}
      </button>}
    </>
  )
}

export default App
