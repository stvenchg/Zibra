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

// Socket.IO setup with improved ping timeout and interval
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store connected devices
const connectedDevices = new Map();
// Map to store pending ICE candidates
const pendingIceCandidates = new Map();

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
  
  // Store pending ICE candidates for this socket
  if (!pendingIceCandidates.has(socket.id)) {
    pendingIceCandidates.set(socket.id, new Map());
  }
  
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
    
    // If there are pending ICE candidates for this peer, send them now
    const targetPendingCandidates = pendingIceCandidates.get(socket.id);
    if (targetPendingCandidates && targetPendingCandidates.has(to)) {
      const candidates = targetPendingCandidates.get(to);
      console.log(`Sending ${candidates.length} pending ICE candidates to ${to}`);
      candidates.forEach(candidate => {
        io.to(to).emit('signal:ice', {
          from: socket.id,
          candidate
        });
      });
      targetPendingCandidates.delete(to);
    }
  });
  
  socket.on('signal:answer', ({ to, signal }) => {
    console.log(`Signal answer from ${socket.id} to ${to}`);
    io.to(to).emit('signal:answer', {
      from: socket.id,
      signal
    });
    
    // If there are pending ICE candidates for this peer, send them now
    const targetPendingCandidates = pendingIceCandidates.get(socket.id);
    if (targetPendingCandidates && targetPendingCandidates.has(to)) {
      const candidates = targetPendingCandidates.get(to);
      console.log(`Sending ${candidates.length} pending ICE candidates to ${to}`);
      candidates.forEach(candidate => {
        io.to(to).emit('signal:ice', {
          from: socket.id,
          candidate
        });
      });
      targetPendingCandidates.delete(to);
    }
  });
  
  socket.on('signal:ice', ({ to, candidate }) => {
    console.log(`ICE candidate from ${socket.id} to ${to}`);
    
    // Check if target client is connected
    const targetSocket = io.sockets.sockets.get(to);
    if (targetSocket) {
      // Forward the ICE candidate
      io.to(to).emit('signal:ice', {
        from: socket.id,
        candidate
      });
    } else {
      // Store the ICE candidate for later
      console.log(`Target ${to} not connected, queueing ICE candidate`);
      const targetPendingCandidates = pendingIceCandidates.get(socket.id);
      if (!targetPendingCandidates.has(to)) {
        targetPendingCandidates.set(to, []);
      }
      targetPendingCandidates.get(to).push(candidate);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Disconnection: ${socket.id}`);
    connectedDevices.delete(socket.id);
    pendingIceCandidates.delete(socket.id);
    
    // Broadcast updated device list
    io.emit('devices:list', Array.from(connectedDevices.values()));
  });
});

// Basic routes
app.get('/', (req, res) => {
  res.send('Zibra Server Online');
});

// Debugging route for connected devices
app.get('/debug/devices', (req, res) => {
  res.json({
    devices: Array.from(connectedDevices.entries()).map(([id, device]) => ({
      id,
      name: device.name,
      pendingIceCandidates: pendingIceCandidates.has(id) ? 
        Array.from(pendingIceCandidates.get(id).entries()).map(([target, candidates]) => ({
          target,
          candidateCount: candidates.length
        })) : []
    }))
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`To access locally: http://localhost:${PORT}`);
  for (const ip of localIPs) {
    console.log(`To access on network: http://${ip}:${PORT}`);
  }
}); 