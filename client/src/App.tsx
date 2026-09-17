import { useState, useRef, useEffect } from 'react';
import './App.css';

interface Track {
  song?: string;
  Song?: string;
  artist?: string;
  Artist?: string;
}

interface SavedSearch {
  id: number;
  song: string;
  artist: string;
}

function App() {
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [userId, setUserId] = useState<number | null>(null); 
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    if (userId) {
      fetchSavedSearches();
    } else {
      setSavedSearches([]);
    }
  }, [userId]);

  const fetchSavedSearches = async () => {
    try {
      const response = await fetch('https://similarsongs-iiuy.onrender.com/api/saved-searches', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSavedSearches(data);
      }
    } catch {
      console.error('Failed to fetch saved searches');
    }
  };

  const handleDeleteSearch = async (id: number) => {
    try {
      const response = await fetch(`https://similarsongs-iiuy.onrender.com/api/saved-searches/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        setSavedSearches(prev => prev.filter(search => search.id !== id));
      }
    } catch {
      console.error('Failed to delete search');
    }
  };

  const handleClearHistory = async () => {
    
    if (!window.confirm('Are you sure you want to clear your entire search history?')) return;

    try {
      const response = await fetch('https://similarsongs-iiuy.onrender.com/api/saved-searches', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        setSavedSearches([]); 
      }
    } catch {
      console.error('Failed to clear history');
    }
  };

  const handleAuth = async () => {
    setAuthError('');
    try {
      const endpoint = authMode === 'login' ? '/api/login' : '/api/signup';
      const response = await fetch(`https://similarsongs-iiuy.onrender.com${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword }),
        credentials: 'include'
      });
      
      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }

      setUserId(data.userId);
      setAuthUsername('');
      setAuthPassword('');
    } catch {
      setAuthError('Server error during authentication.');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('https://similarsongs-iiuy.onrender.com/api/logout', { 
        method: 'POST',
        credentials: 'include'
      });
      setUserId(null);
      setResults([]);
      setSong('');
      setArtist('');
    } catch {
      setAuthError('Failed to log out.');
    }
  };

  const handleSearch = async (searchSong = song, searchArtist = artist) => {
    setError('');
    setResults([]);
    setPreviewUrl('');

    const params = new URLSearchParams();
    if (searchSong) params.append('song', searchSong);
    if (searchArtist) params.append('artist', searchArtist);

    try {
      const response = await fetch(`https://similarsongs-iiuy.onrender.com/api/similar?${params.toString()}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setResults(data);

      if (userId !== null && (searchSong || searchArtist) && data.length > 0) {
        const alreadySaved = savedSearches.some(s => 
          (s.song || '').toLowerCase() === searchSong.toLowerCase() && 
          (s.artist || '').toLowerCase() === searchArtist.toLowerCase()
        );

        if (!alreadySaved) {
          fetch('https://similarsongs-iiuy.onrender.com/api/saved-searches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song: searchSong, artist: searchArtist }),
            credentials: 'include'
          }).then(res => {
            if (res.ok) fetchSavedSearches();
          });
        }
      }

    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const handlePlay = async (trackSong: string, trackArtist: string) => {
    try {
      const params = new URLSearchParams({ song: trackSong, artist: trackArtist });
      const response = await fetch(`https://similarsongs-iiuy.onrender.com/api/preview?${params.toString()}`);
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
    <div className="app" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      
      <div className="auth-bar" style={{ padding: '10px', background: '#f0f0f0', marginBottom: '20px', borderRadius: '8px' }}>
        {userId ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Logged in as User #{userId}</span>
            <button onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <div>
            <input type="text" placeholder="Username" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} />
            <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
            <button onClick={handleAuth}>{authMode === 'login' ? 'Login' : 'Sign Up'}</button>
            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'blue', cursor: 'pointer' }}>
              Switch to {authMode === 'login' ? 'Sign Up' : 'Login'}
            </button>
            {authError && <span style={{ color: 'red', marginLeft: '10px' }}>{authError}</span>}
          </div>
        )}
      </div>

      <h1>Similar Songs</h1>

      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN: Main App */}
        <div style={{ flex: 1 }}>
          <div className="search-bar" style={{ marginBottom: '20px' }}>
            <input type="text" placeholder="Song" value={song} onChange={(e) => setSong(e.target.value)} />
            <input type="text" placeholder="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
            <button onClick={() => handleSearch(song, artist)}>Search</button>
          </div>

          {error && <p className="error" style={{ color: 'red' }}>{error}</p>}

          {results.length > 0 && (
            <table style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Song</th>
                  <th>Artist</th>
                  <th>Play</th>
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
            <audio ref={audioRef} src={previewUrl} controls style={{ marginTop: '20px', width: '100%' }} />
          )}
        </div>

        {/* RIGHT COLUMN: Saved Searches */}
        {userId !== null && savedSearches.length > 0 && (
          <div className="saved-searches" style={{ width: '300px', padding: '15px', background: '#fafafa', border: '1px solid #ddd', borderRadius: '8px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Search History</h3>
              <button 
                onClick={handleClearHistory}
                style={{ background: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8em', cursor: 'pointer' }}
              >
                Clear All
              </button>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {savedSearches.map((s) => (
                <li key={s.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', fontSize: '0.9em' }}>
                  <button 
                    style={{ marginRight: '8px', padding: '2px 6px', fontSize: '0.8em', cursor: 'pointer' }}
                    onClick={() => {
                      setSong(s.song);
                      setArtist(s.artist);
                      handleSearch(s.song, s.artist);
                    }}
                  >
                    Load
                  </button>
                  
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <strong>{s.song || 'Any'}</strong> - <em>{s.artist || 'Any'}</em>
                  </span>

                  <button 
                    onClick={() => handleDeleteSearch(s.id)}
                    style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '1.2em' }}
                    title="Delete"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;