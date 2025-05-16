import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { networkInterfaces } from 'os';

// Configuration
const PORT = process.env.PORT || 3001;
const app = express();
const server = createServer(app);

// Middleware
app.use(cors());

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store connected devices
const connectedDevices = new Map();

// Get local IP addresses
const getLocalIPs = () => {
  const interfaces = networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  
  return addresses;
};

// Log local IP addresses
const localIPs = getLocalIPs();
console.log('Local network interfaces:', localIPs);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  
  // Device announcement
  socket.on('device:announce', ({ name }) => {
    connectedDevices.set(socket.id, { id: socket.id, name });
    
    // Broadcast updated device list to all clients
    io.emit('devices:list', Array.from(connectedDevices.values()));
    
    console.log(`Device announced: ${name} (${socket.id})`);
  });
  
  // WebRTC Signaling
  socket.on('signal:offer', ({ to, signal }) => {
    console.log(`Signal offer from ${socket.id} to ${to}`);
    io.to(to).emit('signal:offer', {
      from: socket.id,
      signal
    });
  });
  
  socket.on('signal:answer', ({ to, signal }) => {
    console.log(`Signal answer from ${socket.id} to ${to}`);
    io.to(to).emit('signal:answer', {
      from: socket.id,
      signal
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Disconnection: ${socket.id}`);
    connectedDevices.delete(socket.id);
    
    // Broadcast updated device list
    io.emit('devices:list', Array.from(connectedDevices.values()));
  });
});

// Basic routes
app.get('/', (req, res) => {
  res.send('Zibra server online');
});

// Start server
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`To access locally: http://localhost:${PORT}`);
  for (const ip of localIPs) {
    console.log(`To access on the network: http://${ip}:${PORT}`);
  }
}); 