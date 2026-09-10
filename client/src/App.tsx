import { useState } from 'react';
import './App.css';

interface Track {
  song?: string;
  Song?: string;
  artist?: string;
  Artist?: string;
}

function App() {
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    setError('');
    setResults([]);

    const params = new URLSearchParams();
    if (song) params.append('song', song);
    if (artist) params.append('artist', artist);

    try {
      const response = await fetch(`http://localhost:3000/api/similar?${params.toString()}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setResults(data);
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="app">
      <h1>Similar Songs</h1>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Song"
          value={song}
          onChange={(e) => setSong(e.target.value)}
        />
        <input
          type="text"
          placeholder="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      {error && <p className="error">{error}</p>}

      {results.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Song</th>
              <th>Artist</th>
            </tr>
          </thead>
          <tbody>
            {results.map((track, i) => (
              <tr key={i}>
                <td>{track.Song ?? track.song}</td>
                <td>{track.Artist ?? track.artist}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
