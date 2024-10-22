import Redis from 'ioredis';
import express from 'express';
import cors from 'cors';
import { Client } from 'cassandra-driver';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import 'dotenv/config'
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename) 

const cassandraClient = new Client({
  cloud: {
    secureConnectBundle: "C:/Users/rupay/Downloads/secure-connect-place.zip", 
  },
  credentials: {
    username: process.env.CASS_USERNAME, 
    password: process.env.CASS_PASSWORD
  },
});

const client = new Redis(
  {
        host:process.env.REDIS_URL,
    port:process.env.REDIS_PORT,
    password:process.env.REDIS_PASSWORD
  }
);

// Initialize Express
const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new SocketIO(server,{
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],       
        credentials: true              
    }
  });
app.use(express.json()); // To parse JSON request bodies

const port = 8000;

app.use(express.static(path.join(__dirname,"/client/dist")))

// Endpoint to get the canvas data
app.get('/get-canvas', async (req, res) => {

    try {
    const binaryData = await client.getBuffer("canvas");
    res.status(200).send(binaryData);
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to get pixel data
app.get('/get-pixel-data', async (req, res) => {
  let { x, y } = req.query; // Changed to query parameters
  try {
    const result = await cassandraClient.execute('SELECT * FROM canvas.canvas WHERE x = ? AND y = ?', [x, y]);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});



app.get('/get-user-data',async(req, res)=>{
  const { userName } = req.query;
  try {
    // Check the last placement timestamp
    const query = 'SELECT timestamp FROM canvas.user WHERE username = ?';
    const result = await cassandraClient.execute(query, [userName], { prepare: true });
    let lastPlacementTime = result.rowLength ? result.rows[0].timestamp : null;
    let currentTime = Date.now();
    // Check if the cooldown period has passed
    if (!result.rowLength){
      return res.status(200).send(`-1`)
    }
    if (lastPlacementTime && currentTime - lastPlacementTime < COOLDOWN_PERIOD) {
      return res.status(200).send(`${COOLDOWN_PERIOD-currentTime+lastPlacementTime}`);
    }

    return res.status(200).send(`-1`)}
    catch (err) {
      res.status(500).json({ err })};
})




const COOLDOWN_PERIOD = parseInt(process.env.TIMEOUT,10);
// API endpoint for placing a tile
app.post('/place-tile', async (req, res) => {
  const { userName, tileDetails } = req.body;
  let { x,y,offset, color } = tileDetails;


  try {
    // Check the last placement timestamp
    const query = 'SELECT timestamp FROM canvas.user WHERE username = ?';
    const result = await cassandraClient.execute(query, [userName], { prepare: true });
    
    let lastPlacementTime = result.rowLength ? result.rows[0].timestamp : null;
    let currentTime = Date.now();
    // Check if the cooldown period has passed
    if (lastPlacementTime && currentTime - lastPlacementTime < COOLDOWN_PERIOD) {
      return res.status(400).json({ error: 'Cooldown period has not passed. Try again later.' });
    }

    // Update the canvas in Redis
    await client.bitfield("canvas", 'SET','u4',`${offset * 4}`, color);

    // Insert tile details into Cassandra
    const insertQuery = 'INSERT INTO canvas.canvas (offset, color, time, username) VALUES (?, ?, ?, ?)';
    await cassandraClient.execute(insertQuery, [offset, color, currentTime, userName], { prepare: true });

    // Update the user's last tile placement timestamp in Cassandra
    const updateQuery = 'UPDATE canvas.user SET timestamp = ? WHERE username = ?';
    await cassandraClient.execute(updateQuery, [currentTime, userName], { prepare: true });
    // Notify connected clients about the new tile placement
    io.emit('pixel-update', { x,y, offset, color, userName });
    res.status(200).json({ message: 'Tile placed successfully.' });

  } catch (err) {
    res.status(500).json({ err });
  }
});

// Socket.IO connection
io.on('connection', (socket) => {
  
  // Handle disconnection
  socket.on('disconnect', () => {
  });
});
app.get("*",(req,res)=>
    res.sendFile(path.join(__dirname,"/client/dist/index.html")))

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
