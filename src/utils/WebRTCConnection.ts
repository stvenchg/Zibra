import { EventEmitter } from 'events';

interface RTCConfig {
  iceServers?: RTCIceServer[];
}

export class WebRTCConnection extends EventEmitter {
  private connection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private isInitiator: boolean;
  private connected = false;
  private pendingCandidates: RTCIceCandidate[] = [];

  constructor(initiator: boolean = false, config: RTCConfig = {}) {
    super();
    this.isInitiator = initiator;
    
    // Enhanced configuration with more reliable public STUN/TURN servers
    const defaultConfig: RTCConfiguration = {
      iceServers: config.iceServers || [
        // Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        
        // Twilio STUN servers
        { urls: 'stun:global.stun.twilio.com:3478' },
        
        // Public TURN servers (ideally replace with your own TURN servers)
        {
          urls: 'turn:numb.viagenie.ca',
          username: 'webrtc@live.com',
          credential: 'muazkh'
        },
        {
          urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
          username: 'webrtc',
          credential: 'webrtc'
        }
      ],
      iceCandidatePoolSize: 10,
      // Additional options to improve connectivity
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };
    
    console.log('Creating WebRTC connection with config:', defaultConfig);
    
    // Create WebRTC connection
    this.connection = new RTCPeerConnection(defaultConfig);
    
    // Setup connection events
    this.setupConnectionEvents();
    
    // If we're the initiator, create a data channel
    if (initiator) {
      this.createDataChannel();
    } else {
      // Listen for incoming data channels
      this.connection.ondatachannel = (event) => {
        console.log('Received data channel:', event.channel.label);
        this.setupDataChannel(event.channel);
      };
    }
  }
  
  private setupConnectionEvents() {
    // Handle ICE candidates
    this.connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Generated ICE candidate:', event.candidate.candidate.substring(0, 50) + '...');
        // Emit the candidate to send to the other peer
        this.emit('ice', event.candidate);
      } else {
        console.log('ICE candidate gathering completed');
      }
    };
    
    // ICE connection state
    this.connection.oniceconnectionstatechange = () => {
      console.log('ICE connection state changed to:', this.connection.iceConnectionState);
      
      if (this.connection.iceConnectionState === 'connected' || 
          this.connection.iceConnectionState === 'completed') {
        this.connected = true;
        this.emit('connect');
      } else if (this.connection.iceConnectionState === 'disconnected' || 
                this.connection.iceConnectionState === 'failed' ||
                this.connection.iceConnectionState === 'closed') {
        this.connected = false;
        this.emit('close');
        
        // Emit a specific error when ICE connection fails
        if (this.connection.iceConnectionState === 'failed') {
          this.emit('error', new Error('ICE connection failed'));
        }
      }
    };

    // ICE gathering state
    this.connection.onicegatheringstatechange = () => {
      console.log('ICE gathering state changed to:', this.connection.iceGatheringState);
    };

    // Connection state
    this.connection.onconnectionstatechange = () => {
      console.log('Connection state changed to:', this.connection.connectionState);
      
      if (this.connection.connectionState === 'connected') {
        this.connected = true;
        this.emit('connect');
      } else if (this.connection.connectionState === 'disconnected' || 
                this.connection.connectionState === 'failed' ||
                this.connection.connectionState === 'closed') {
        this.connected = false;
        this.emit('close');
        
        // Emit a specific error when connection fails
        if (this.connection.connectionState === 'failed') {
          this.emit('error', new Error('Connection failed'));
        }
      }
    };
    
    // Debug: monitor needed negotiations
    this.connection.onnegotiationneeded = () => {
      console.log('Negotiation needed');
    };
  }
  
  private createDataChannel() {
    try {
      console.log('Creating data channel');
      this.dataChannel = this.connection.createDataChannel('fileTransfer', {
        ordered: true, // Ensures packets arrive in order
        // Fully reliable mode - no retransmission limit
        // Do not specify maxRetransmits or maxPacketLifeTime for maximum reliability
      });
      this.setupDataChannel(this.dataChannel);
    } catch (error) {
      console.error('Error creating data channel:', error);
      this.emit('error', error);
    }
  }
  
  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    
    console.log(`Data channel ${channel.label} setup with state: ${channel.readyState}`);
    
    channel.onopen = () => {
      console.log(`Data channel ${channel.label} opened`);
      this.connected = true;
      this.emit('connect');
    };
    
    channel.onclose = () => {
      console.log(`Data channel ${channel.label} closed`);
      this.connected = false;
      this.emit('close');
    };
    
    channel.onmessage = (event) => {
      console.log(`Received message on channel ${channel.label}, size:`, 
        typeof event.data === 'string' ? event.data.length : event.data.byteLength);
      this.emit('data', event.data);
    };
    
    channel.onerror = (error) => {
      console.error(`Data channel ${channel.label} error:`, error);
      this.emit('error', error);
    };
  }
  
  // Create an offer (for initiator)
  async createOffer() {
    if (!this.isInitiator) {
      console.warn('Only initiator should create offer');
      return;
    }
    
    try {
      console.log('Creating offer');
      const offer = await this.connection.createOffer({
        // Options to improve compatibility and stability
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
        iceRestart: false
      });
      console.log('Offer created, setting local description');
      await this.connection.setLocalDescription(offer);
      
      // Emit the offer to send to the other peer
      console.log('Local description set, emitting signal');
      this.emit('signal', this.connection.localDescription);
    } catch (error) {
      console.error('Error creating offer:', error);
      this.emit('error', error);
    }
  }
  
  // Receive a signal (offer, answer, or ICE candidate)
  async signal(data: any) {
    try {
      // Handle ICE candidates
      if (data.candidate || (data.candidate === '' && data.sdpMid)) {
        console.log('Received ICE candidate:', data.candidate ? data.candidate.substring(0, 50) + '...' : 'null candidate');
        
        // If remote description is not set yet, queue the candidate
        if (!this.connection.remoteDescription) {
          console.log('Remote description not set, queuing ICE candidate');
          this.pendingCandidates.push(data);
          return;
        }
        
        try {
          await this.connection.addIceCandidate(new RTCIceCandidate(data));
          console.log('ICE candidate added');
        } catch (err) {
          // Handle ICE candidate addition errors specifically
          console.error('Error adding ICE candidate:', err);
          // Do not propagate error to avoid interrupting connection for a rejected candidate
        }
        return;
      }
      
      // Handle offer or answer
      if (data.type === 'offer' || data.type === 'answer') {
        console.log(`Received ${data.type}`);
        
        try {
          // Add a delay before setting remote description
          // This can help with some implementations that have timing issues
          await new Promise(resolve => setTimeout(resolve, 100));
          
          await this.connection.setRemoteDescription(new RTCSessionDescription(data));
          console.log('Remote description set');
          
          // If it's an offer, send an answer
          if (data.type === 'offer') {
            console.log('Creating answer');
            const answer = await this.connection.createAnswer();
            console.log('Setting local description (answer)');
            await this.connection.setLocalDescription(answer);
            console.log('Emitting answer');
            this.emit('signal', this.connection.localDescription);
          }
          
          // Add any queued ICE candidates
          if (this.pendingCandidates.length > 0) {
            console.log(`Processing ${this.pendingCandidates.length} queued ICE candidates`);
            for (const candidate of this.pendingCandidates) {
              try {
                await this.connection.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.error('Error adding queued ICE candidate:', err);
                // Continue with other candidates
              }
            }
            this.pendingCandidates = [];
            console.log('All queued ICE candidates processed');
          }
        } catch (err) {
          // Check if it's a state error
          if (String(err).includes('Called in wrong state') || 
              String(err).includes('InvalidStateError')) {
            console.warn(`Invalid state for setting remote description: ${data.type}`, err);
            this.emit('error', new Error(`Invalid state for ${data.type} processing`));
          } else {
            console.error(`Error setting remote description for ${data.type}:`, err);
            this.emit('error', err);
          }
        }
      }
    } catch (error) {
      console.error('Error handling signal:', error);
      this.emit('error', error);
    }
  }
  
  // Send data
  send(data: any): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('Data channel not open, current state:', this.dataChannel?.readyState);
      return false;
    }
    
    try {
      // Implementation of protection against large files
      if (data instanceof ArrayBuffer && data.byteLength > 256 * 1024) {
        console.warn(`Sending a large chunk (${data.byteLength} bytes), caution advised`);
      }
      
      // Limit sending speed for large chunks
      this.dataChannel.send(data);
      return true;
    } catch (error) {
      console.error('Error sending data:', error);
      
      // If it's a closed channel error, try to handle gracefully
      if (String(error).includes('closed') || 
          (this.dataChannel && this.dataChannel.readyState !== 'open')) {
        this.emit('error', new Error('DataChannel closed unexpectedly'));
        
        // Mark connection as closed to force a reconnection
        this.connected = false;
        setTimeout(() => this.emit('close'), 0);
      } else {
        this.emit('error', error);
      }
      
      return false;
    }
  }
  
  // Close the connection
  close() {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (error) {
        console.error('Error closing data channel:', error);
      }
      this.dataChannel = null;
    }
    
    if (this.connection) {
      try {
        this.connection.close();
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }
    
    this.connected = false;
  }
  
  // Check if connection is established
  isConnected(): boolean {
    return this.connected;
  }
} 