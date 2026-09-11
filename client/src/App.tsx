import { useState, useRef } from 'react';
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
  const [previewUrl, setPreviewUrl] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleSearch = async () => {
    setError('');
    setResults([]);
    setPreviewUrl('');

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

  const handlePlay = async (trackSong: string, trackArtist: string) => {
    try {
      const params = new URLSearchParams({ song: trackSong, artist: trackArtist });
      const response = await fetch(`http://localhost:3000/api/preview?${params.toString()}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setPreviewUrl(data);

      setTimeout(() => audioRef.current?.play(), 0);
    } catch {
      setError('Could not load preview.');
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map((track, i) => {
              const trackSong = track.Song ?? track.song ?? '';
              const trackArtist = track.Artist ?? track.artist ?? '';
              return (
                <tr key={i}>
                  <td>{trackSong}</td>
                  <td>{trackArtist}</td>
                  <td>
                    <button onClick={() => handlePlay(trackSong, trackArtist)}>▶</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {previewUrl && (
        <audio ref={audioRef} src={previewUrl} controls style={{ marginTop: 16 }} />
      )}
    </div>
  );
}

export default App;
