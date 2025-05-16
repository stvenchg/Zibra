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
    
    // Default config with public STUN servers
    const defaultConfig: RTCConfiguration = {
      iceServers: config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        // Add some TURN servers for better NAT traversal
        {
          urls: 'turn:numb.viagenie.ca',
          username: 'webrtc@live.com',
          credential: 'muazkh'
        }
      ],
      iceCandidatePoolSize: 10
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
      }
    };
  }
  
  private createDataChannel() {
    try {
      console.log('Creating data channel');
      this.dataChannel = this.connection.createDataChannel('fileTransfer', {
        ordered: true
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
      const offer = await this.connection.createOffer();
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
        await this.connection.addIceCandidate(new RTCIceCandidate(data));
        console.log('ICE candidate added');
        return;
      }
      
      // Handle offer or answer
      if (data.type === 'offer' || data.type === 'answer') {
        console.log(`Received ${data.type}`);
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
            await this.connection.addIceCandidate(new RTCIceCandidate(candidate));
          }
          this.pendingCandidates = [];
          console.log('All queued ICE candidates processed');
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
      this.dataChannel.send(data);
      return true;
    } catch (error) {
      console.error('Error sending data:', error);
      this.emit('error', error);
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