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

// Fonction pour déterminer si deux adresses IP sont sur le même sous-réseau (classe C)
const isSameSubnet = (ip1, ip2) => {
  if (!ip1 || !ip2) return false;
  
  // Extraire les 3 premiers octets pour une comparaison de classe C
  const subnet1 = ip1.split('.').slice(0, 3).join('.');
  const subnet2 = ip2.split('.').slice(0, 3).join('.');
  
  return subnet1 === subnet2;
};

// Log local IP addresses
const localIPs = getLocalIPs();
console.log('Local network interfaces:', localIPs);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  
  // Récupérer l'adresse IP du client
  const clientIP = socket.handshake.address.replace(/^::ffff:/, '');
  console.log(`Client IP: ${clientIP}`);
  
  // Store pending ICE candidates for this socket
  if (!pendingIceCandidates.has(socket.id)) {
    pendingIceCandidates.set(socket.id, new Map());
  }
  
  // Device announcement
  socket.on('device:announce', ({ name }) => {
    connectedDevices.set(socket.id, { 
      id: socket.id, 
      name,
      ip: clientIP
    });
    
    // Envoi de la liste des appareils adaptée à chaque client
    sendFilteredDevicesList();
    
    console.log(`Device announced: ${name} (${socket.id}) from IP ${clientIP}`);
  });
  
  // Function pour envoyer une liste d'appareils filtrée à chaque client
  const sendFilteredDevicesList = () => {
    // Envoyer une liste d'appareils personnalisée à chaque client
    for (const [socketId, deviceInfo] of connectedDevices.entries()) {
      const deviceList = [];
      
      // Pour chaque appareil connecté
      for (const [id, device] of connectedDevices.entries()) {
        // Ne pas inclure l'appareil lui-même dans sa liste
        if (id !== socketId) {
          // Si le dispositif est sur le même sous-réseau, l'ajouter à la liste
          if (isSameSubnet(deviceInfo.ip, device.ip)) {
            deviceList.push({
              id: device.id,
              name: device.name
            });
          }
        }
      }
      
      // Envoyer la liste filtrée à cet appareil spécifique
      io.to(socketId).emit('devices:list', deviceList);
    }
  };
  
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
    
    // Envoyer la liste mise à jour à tous les clients
    sendFilteredDevicesList();
  });
});

// Basic routes
app.get('/', (req, res) => {
  res.send('DEV Zibra Signaling Server is up and running.');
});

// Debugging route for connected devices
app.get('/debug/devices', (req, res) => {
  res.json({
    devices: Array.from(connectedDevices.entries()).map(([id, device]) => ({
      id,
      name: device.name,
      ip: device.ip,
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