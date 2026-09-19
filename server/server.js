const express=require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');
const { RedisStore } = require('connect-redis');
const morgan = require('morgan');
require('dotenv').config();

const app=express();

app.use(morgan('dev'));

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);
app.use(cors({
    origin: 'https://similar-songs-xk54.vercel.app', 
    credentials: true 
}));

app.use(express.json());

app.set('trust proxy', 1);
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SECRET_PASSWORD, 
    resave: false, 
    saveUninitialized: false, 
    cookie: { 
        secure: true,
        httpOnly: true, 
        sameSite: 'none',
        maxAge: 1000 * 60 * 60 * 24
    }
}));

const db=new Database('cache.db');

db.exec(`CREATE TABLE IF NOT EXISTS cache(
    song TEXT,
    artist TEXT,
    similar_songs TEXT,
    UNIQUE(song,artist)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
)`);

db.exec(`CREATE TABLE IF NOT EXISTS saved_searches(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    song TEXT NOT NULL,
    artist TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`); 

function checkCacheAndAttach(req, res, next) {
    const { song, artist } = req.query;
    if (song && artist) {
        const cached = db.prepare('SELECT * FROM cache WHERE song = ? AND artist = ?').get(song, artist);
        req.cacheHit = cached;
    }
    next();
}
const ipLoginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.ip,
    message: { error: 'Too many login attempts from this IP, try again later' }
});

const usernameLoginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.body.username || 'unknown',
    message: { error: 'Too many attempts for this account, try again later' }
});

const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.ip,
    skip: (req) => Boolean(req.cacheHit),
    message: { error: 'Too many searches, try again later' }
});

app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const insert = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
        const info = insert.run(username, hashedPassword);
        req.session.regenerate((err) => {
          if (err) {
            return res.status(500).json({ error: 'Login failed' });
          }
          req.session.userId = info.lastInsertRowid;
          return res.json({ message: 'Signup successful', userId: info.lastInsertRowid });
        });
        
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Username already taken' });
        }
        console.error('Signup Error',error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/login', ipLoginLimiter, usernameLoginLimiter,async (req, res) => {
    const { username, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      
    }

    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    req.session.regenerate((err) => {
    if (err) {
      console.error('Session Regeneration Error', err);
        return res.status(500).json({ error: 'Login failed' });
    }
    req.session.userId = user.id;
    return res.json({ message: 'Login successful', userId: user.id });
  });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
          console.error('Logout Error', err);
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('connect.sid');
        return res.json({ message: 'Logged out' });
    });
});

app.post('/api/saved-searches',(req,res)=>{
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const {song,artist}=req.body;
  db.prepare('INSERT INTO saved_searches (user_id,song, artist) VALUES (?, ?, ?)').run(req.session.userId,song, artist);
  return res.json({message:'Successfully saved search'})

})

app.get('/',(req,res)=>{
    res.send('Server is alive');
})

app.get('/api/similar', checkCacheAndAttach,apiLimiter, async (req, res) => {
  const { song, artist } = req.query;

  if(req.cacheHit){
    return res.json(JSON.parse(req.cacheHit.similar_songs));
  }

  if(!song&&!artist){
    console.error('Both song and artist are missing in the request');
    return res.status(400).json({error:'atleast one of song and artist needed'})
  }


  if(song&&!artist){
    try{
    const url=`https://ws.audioscrobbler.com/2.0/?method=track.search&track=${song}&api_key=${process.env.LASTFM_API_KEY}&format=json`
    const response=await fetch(url);
    const data=await response.json();
    const result=[];

    if(!data.results.trackmatches.track[0]){
      console.error('No tracks found for the given song:', song);
        return res.status(400).json({error:'song not valid'})
    }

    //res.json(data)

    let i=0;
  while(i<10&&data.results.trackmatches.track[i]){
  result.push({song: data.results.trackmatches.track[i].name, artist:data.results.trackmatches.track[i].artist });
  i++;
  }

  return res.json(result)}

  catch{
    console.error('Error fetching top tracks for song:', song);
    return res.status(500).json({error:'Error'})
  }
  }

  if(!song&&artist){
    try{
    const url=`https://ws.audioscrobbler.com/2.0/?method=artist.getTopTracks&artist=${artist}&api_key=${process.env.LASTFM_API_KEY}&format=json`
    const response=await fetch(url);
    const data=await response.json();
    const result=[];

    if(!data.toptracks){
      console.error('No top tracks found for the given artist:', artist);
        return res.status(400).json({error:'artist not valid'})
    }

//res.json(data)

    let i=0;
  while(i<10&&data.toptracks.track[i]){
  result.push({song: data.toptracks.track[i].name, artist:data.toptracks.track[i].artist.name });
  i++;
  }

  return res.json(result)}

  catch{
    console.error('Error fetching top tracks for artist:', artist);
    return res.status(500).json({error:'error'})
  }

  }
  const row = db.prepare('SELECT similar_songs FROM cache WHERE song = ? AND artist = ?').get(song, artist);
  if(!row){
  try{

  const url=`https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${artist}&track=${song}&api_key=${process.env.LASTFM_API_KEY}&format=json`
  const response = await fetch(url);
  const data = await response.json();

  if(data.error){
    console.error('Error fetching similar tracks:', data.message);
    return res.status(404).json({error:'song not found'})
  }
  const result=[];

  let i=0;
  while(i<10&&data.similartracks.track[i]){
  result.push({song: data.similartracks.track[i].name, artist:data.similartracks.track[i].artist.name });
  i++;
  }

  if (result.length === 0) {
    console.error('No similar songs found for:', song, 'by', artist);
    return res.status(404).json({ error: 'No similar songs found.' });
  }

  db.prepare('INSERT INTO cache (song, artist, similar_songs) VALUES (?, ?, ?)').run(song, artist,JSON.stringify(result) );

  return res.json(result)
  //res.json(data)
}
catch(error){
  console.error('Error fetching similar tracks:', error);
    return res.status(500).json({error:'internal server error'})
}}
else{
    res.json(JSON.parse(row.similar_songs))
}
});

app.get('/api/saved-searches',async (req,res)=>{
  if(!req.session.userId){
    return res.status(401).json({error:'Unauthorized'})
  }
  const userSearches = db.prepare('SELECT id, song, artist FROM saved_searches WHERE user_id = ?').all(req.session.userId);
  return res.json(userSearches);
});

app.get('/api/preview',async(req,res)=>{
  const {song,artist}=req.query;
  const response=await fetch(`https://itunes.apple.com/search?term=${song}+${artist}&media=music&limit=1`)
  const data=await response.json();
  if(!data.results[0]){
    console.error('No preview found for song:', song, 'by artist:', artist);
    return res.status(404).json({error:"song file not found"})
  }
  return res.json( data.results[0].previewUrl)
});

app.delete('/api/saved-searches/:id', (req, res) => {
  if (!req.session.userId) {
    console.error('Unauthorized delete attempt for search ID:', req.params.id); 
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const searchId = req.params.id;
  
  const result = db.prepare('DELETE FROM saved_searches WHERE id = ? AND user_id = ?').run(searchId, req.session.userId);
  
  if (result.changes === 0) {
    console.error('Delete failed for search ID:', searchId, 'User ID:', req.session.userId);
    return res.status(404).json({ error: 'Search not found or not yours' });
  }

  return res.json({ message: 'Deleted successfully' });
});


app.delete('/api/saved-searches', (req, res) => {
  if (!req.session.userId) {
    console.error('Unauthorized attempt to clear saved searches');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  db.prepare('DELETE FROM saved_searches WHERE user_id = ?').run(req.session.userId);
  
  return res.json({ message: 'History cleared' });
});


app.listen(3000,()=>{
    console.log('Server running on port 3000');
})