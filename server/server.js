const express=require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
require('dotenv').config();
const app=express();
app.use(cors());
const db=new Database('cache.db');

db.exec(`CREATE TABLE IF NOT EXISTS cache(
    song TEXT,artist TEXT,similar_songs TEXT,UNIQUE(song,artist))
    `)

app.get('/',(req,res)=>{
    res.send('Server is alive');
})

app.get('/test', (req, res) => {
  const name=req.query.name;
  res.send(`Welcome,${name}`)
});

app.get('/api/similar', async (req, res) => {
  const { song, artist } = req.query;


  if(!song&&!artist){
    return res.status(400).json({error:'atleast one of song and artist needed'})
  }


  if(song&&!artist){
    try{
    const url=`https://ws.audioscrobbler.com/2.0/?method=track.search&track=${song}&api_key=${process.env.LASTFM_API_KEY}&format=json`
    const response=await fetch(url);
    const data=await response.json();
    const result=[];

    if(!data.results.trackmatches.track[0]){
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
    return res.status(500).json({error:'error'})
  }
  }

  if(!song&&artist){
    try{
    const url=`https://ws.audioscrobbler.com/2.0/?method=artist.getTopTracks&artist=${artist}&api_key=${process.env.LASTFM_API_KEY}&format=json`
    const response=await fetch(url);
    const data=await response.json();
    const result=[];

    if(!data.toptracks){
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
    return res.status(404).json({error:'song not found'})
  }
  const result=[];

  let i=0;
  while(i<10&&data.similartracks.track[i]){
  result.push({song: data.similartracks.track[i].name, artist:data.similartracks.track[i].artist.name });
  i++;
  }


  db.prepare('INSERT INTO cache (song, artist, similar_songs) VALUES (?, ?, ?)').run(song, artist,JSON.stringify(result) );


  return res.json(result)
  //res.json(data)
}
catch(error){
    return res.status(500).json({error:'internal server error'})
}}
else{
    res.json(JSON.parse(row.similar_songs))
}
});
app.get('/api/preview',async(req,res)=>{
  const {song,artist}=req.query;
  const response=await fetch(`https://itunes.apple.com/search?term=${song}+${artist}&media=music&limit=1`)
  const data=await response.json();
  if(!data.results[0]){
    return res.status(404).json({error:"song file not found"})
  }
  return res.json( data.results[0].previewUrl)
});
app.listen(3000,()=>{
    console.log('Server running on port 3000');
})