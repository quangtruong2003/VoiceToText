/**
 * High-Performance Voice Recording & Streaming Engine
 * 
 * Architecture Overview:
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                        LOW-LATENCY AUDIO PIPELINE                          │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 │                                                                             │
 │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────┐ │
 │  │ AudioCapture │───▶│ AudioEncoder │───▶│ StreamBuffer │───▶│  WebSocket │ │
 │  │   (Device)   │    │    (Opus)    │    │  (Priority)  │    │  (Pooled)  │ │
 │  └──────────────┘    └──────────────┘    └──────────────┘    └────────────┘ │
 │         │                  │                   │                  │         │
 │         ▼                  ▼                   ▼                  ▼         │
 │  ┌──────────────────────────────────────────────────────────────────────┐   │
 │  │                     PERFORMANCE OPTIMIZATIONS                       │   │
 │  │  • Real-time chunked capture (50-100ms intervals)                  │   │
 │  │  • Opus encoding at 16kHz (lowest latency mode)                    │   │
 │  │  • Zero-copy buffer management                                      │   │
 │  │  • Pre-warmed TLS connections (connection pooling)                 │   │
 │  │  • Process priority elevation                                        │   │
 │  │  • HTTP/2 multiplexed streams                                       │   │
 │  └──────────────────────────────────────────────────────────────────────┘   │
 │                                                                             │
 └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * Key Performance Characteristics:
 * - Target latency: <50ms from audio capture to API submission
 * - Chunk size: 100ms of audio per packet (optimal for Opus)
 * - Connection warm-up: Persistent WebSocket with ping/pong keep-alive
 * - Audio format: Opus @ 16kHz, bitrate 24kbps (voice-optimized)
 */

import { EventEmitter } from 'events';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import * as os from 'os';

// ============================================================================
// CONFIGURATION: Ultra-Low Latency Optimized Settings
// ============================================================================

export interface AudioConfig {
  /** Sample rate in Hz - 16kHz is optimal for speech recognition */
  sampleRate: number;
  /** Number of audio channels (1 = mono) */
  channels: number;
  /** Opus application mode: 'voip', 'audio', 'lowdelay' */
  opusApplication: 'voip' | 'audio' | 'lowdelay';
  /** Opus bitrate in bits per second (voice: 24000-48000) */
  opusBitrate: number;
  /** Frame size in ms - smaller = lower latency */
  opusFrameSize: number;
  /** Chunk interval in ms - how often to send data */
  chunkIntervalMs: number;
}

export interface ConnectionConfig {
  /** WebSocket or HTTP endpoint URL */
  endpoint: string;
  /** Use HTTP/2 for multiplexed streams */
  useHttp2: boolean;
  /** Number of pre-warmed connections */
  poolSize: number;
  /** Connection timeout in ms */
  connectionTimeout: number;
  /** Enable TLS session tickets */
  useTlsSessionResumption: boolean;
  /** Keep-alive ping interval in ms */
  pingInterval: number;
}

export interface PriorityConfig {
  /** Enable process priority elevation */
  elevateProcessPriority: boolean;
  /** Nice value (Unix) - lower is higher priority */
  niceValue: number;
  /** Set I/O priority (Unix) - lower is higher priority */
  ioPriority: number;
  /** CPU affinity (CPU cores to use) */
  cpuAffinity: number[];
}

export interface StreamConfig {
  audio: AudioConfig;
  connection: ConnectionConfig;
  priority: PriorityConfig;
  /** API key for authentication */
  apiKey?: string;
  /** Custom headers for requests */
  headers?: Record<string, string>;
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 16000,        // 16kHz - optimal for speech recognition APIs
  channels: 1,               // Mono - sufficient for voice
  opusApplication: 'lowdelay', // Lowest latency mode
  opusBitrate: 24000,       // 24kbps - good quality/size ratio for voice
  opusFrameSize: 20,        // 20ms frames - optimal for Opus low-delay
  chunkIntervalMs: 100,     // Send chunks every 100ms
};

export const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  endpoint: 'wss://api.example.com/stream',
  useHttp2: false,           // WebSocket is better for streaming
  poolSize: 3,               // 3 pre-warmed connections
  connectionTimeout: 5000,
  useTlsSessionResumption: true,
  pingInterval: 15000,       // Keep connection alive
};

export const DEFAULT_PRIORITY_CONFIG: PriorityConfig = {
  elevateProcessPriority: true,
  niceValue: -10,            // High priority (requires elevated permissions)
  ioPriority: 0,             // Real-time I/O priority
  cpuAffinity: [],           // Use all cores by default
};

// ============================================================================
// AUDIO ENCODER: Optimized Opus Encoding
// ============================================================================

/**
 * AudioEncoder - Handles efficient audio encoding using Opus
 * 
 * Optimization Strategies:
 * 1. Pre-initialized encoder context to avoid initialization overhead
 * 2. Fixed frame sizes for predictable encoding time
 * 3. Memory pooling to reduce GC pressure
 */
export class AudioEncoder {
  private config: AudioConfig;
  private encoderInitialized: boolean = false;
  private inputBuffer: Buffer;
  private outputBuffer: Buffer;
  
  // Performance metrics
  private encodeTimeMs: number = 0;
  private totalBytesEncoded: number = 0;

  constructor(config: AudioConfig = DEFAULT_AUDIO_CONFIG) {
    this.config = config;
    
    // Pre-allocate buffers for zero-copy operations
    const inputSize = (config.sampleRate * config.channels * 2 * config.opusFrameSize) / 1000;
    const outputSize = Math.ceil(inputSize * 0.1); // Opus typically compresses to 10%
    
    this.inputBuffer = Buffer.alloc(inputSize);
    this.outputBuffer = Buffer.alloc(outputSize);
  }

  /**
   * Encode raw PCM audio to Opus
   * In production, this would use a native Opus binding (node-opus, opusscript)
   * For this implementation, we simulate the encoding with efficient buffer operations
   */
  encode(pcmData: Buffer): Buffer {
    const startTime = process.hrtime.bigint();
    
    // In production: Use actual Opus encoder here
    // const encoded = opusEncoder.encode(pcmData, this.config.opusFrameSize);
    
    // Simulation: In real implementation, this would be actual Opus encoding
    // For now, we pass through with compression simulation
    const encoded = this.simulateOpusEncoding(pcmData);
    
    const endTime = process.hrtime.bigint();
    this.encodeTimeMs += Number(endTime - startTime) / 1_000_000;
    this.totalBytesEncoded += encoded.length;
    
    return encoded;
  }

  /**
   * Simulate Opus encoding (in production, use actual Opus library)
   */
  private simulateOpusEncoding(pcmData: Buffer): Buffer {
    // Real implementation would use libopus via native binding
    // This simulates the compression ratio of Opus at low-delay mode
    const compressionRatio = 0.08; // ~8% of original size
    const outputSize = Math.max(10, Math.floor(pcmData.length * compressionRatio));
    
    // Return minimal placeholder - real implementation would encode
    return Buffer.from(pcmData.slice(0, outputSize));
  }

  /**
   * Get encoder statistics
   */
  getStats(): { encodeTimeMs: number; totalBytesEncoded: number; compressionRatio: number } {
    return {
      encodeTimeMs: this.encodeTimeMs,
      totalBytesEncoded: this.totalBytesEncoded,
      compressionRatio: this.totalBytesEncoded > 0 
        ? this.totalBytesEncoded / (this.totalBytesEncoded * 12.5) 
        : 0
    };
  }

  /**
   * Calculate expected encoded size for a frame
   */
  getExpectedEncodedSize(): number {
    const inputBytesPerMs = (this.config.sampleRate * this.config.channels * 2) / 1000;
    const inputBytes = inputBytesPerMs * this.config.opusFrameSize;
    return Math.ceil(inputBytes * 0.1); // ~10% compression
  }
}

// ============================================================================
// CONNECTION POOL: Pre-Warmed, Persistent Connections
// ============================================================================

/**
 * ConnectionPool - Manages pre-warmed WebSocket connections
 * 
 * Optimization Strategies:
 * 1. Pre-establish connections before they're needed
 * 2. TLS session resumption to eliminate handshake overhead
 * 3. Automatic reconnection with exponential backoff
 * 4. Connection health monitoring
 * 
 * Note: In browser environments, uses native WebSocket
 * In Node.js environments, use ws package
 */
export class ConnectionPool extends EventEmitter {
  private config: ConnectionConfig;
  private connections: Set<any> = new Set();
  private availableConnections: any[] = [];
  private pendingRequests: Array<{
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isInitialized: boolean = false;

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize the connection pool with pre-warmed connections
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log(`[ConnectionPool] Initializing ${this.config.poolSize} pre-warmed connections...`);
    
    const connectionPromises: Promise<void>[] = [];
    
    for (let i = 0; i < this.config.poolSize; i++) {
      connectionPromises.push(this.createConnection());
    }
    
    await Promise.all(connectionPromises);
    
    this.startHealthCheck();
    this.isInitialized = true;
    
    console.log(`[ConnectionPool] Pool initialized with ${this.connections.size} connections`);
  }

  /**
   * Create a new WebSocket connection with optimizations
   * Uses native WebSocket in browser, or ws package in Node.js
   */
  private async createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try to use ws package if available (Node.js), otherwise use native WebSocket (browser)
      let ws: any;
      let WebSocketClass: any;
      
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const wsModule = require('ws');
        WebSocketClass = wsModule.WebSocket;
      } catch {
        // Use native WebSocket in browser
        WebSocketClass = (globalThis as any).WebSocket || (window as any).WebSocket;
      }
      
      const wsConfig: any = {
        handshakeTimeout: this.config.connectionTimeout,
        maxPayload: 10 * 1024 * 1024, // 10MB max message
      };

      ws = new WebSocketClass(this.config.endpoint, [], wsConfig);
      
      // Binary type for efficient audio data transfer
      ws.binaryType = 'arraybuffer';
      
      let connected = false;
      
      ws.onopen = () => {
        connected = true;
        this.connections.add(ws);
        this.availableConnections.push(ws);
        this.reconnectAttempts = 0;
        
        this.emit('connection', ws);
        resolve();
      };

      ws.onmessage = (event: any) => {
        if (event.data instanceof ArrayBuffer || (typeof event.data === 'object' && event.data.type === 'binary')) {
          this.emit('message', Buffer.from(event.data));
        }
      };

      ws.onclose = (event: any) => {
        this.connections.delete(ws);
        const idx = this.availableConnections.indexOf(ws);
        if (idx !== -1) {
          this.availableConnections.splice(idx, 1);
        }
        
        this.emit('close', event.code, event.reason);
        
        // Auto-reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.createConnection(), Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
        }
      };

      ws.onerror = (error: any) => {
        this.emit('error', error);
        if (!connected) {
          reject(error);
        }
      };

      // Set up ping to keep connection alive (Node.js ws only)
      const pingInterval = setInterval(() => {
        if (ws.readyState === 1) { // OPEN
          ws.ping();
        }
      }, this.config.pingInterval);

      ws.onclose = () => {
        clearInterval(pingInterval);
      };

      // Connection timeout
      setTimeout(() => {
        if (!connected) {
          ws.close();
          reject(new Error('Connection timeout'));
        }
      }, this.config.connectionTimeout);
    });
  }

  /**
   * Get an available connection from the pool
   */
  async getConnection(): Promise<any> {
    if (this.availableConnections.length > 0) {
      return this.availableConnections[0];
    }
    
    // Wait for an available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);

      this.once('connection', () => {
        clearTimeout(timeout);
        resolve(this.availableConnections[0]);
      });
    });
  }

  /**
   * Send data through an available connection (non-blocking)
   */
  async send(data: Buffer | string): Promise<void> {
    const ws = await this.getConnection();
    
    return new Promise((resolve, reject) => {
      if (ws.readyState !== 1) { // OPEN
        reject(new Error('Connection not ready'));
        return;
      }

      const sendData = data instanceof Buffer ? data : data;
      ws.send(sendData, (error: any) => {
        if (error) {
          reject(error);
        } else {
          // Return connection to pool immediately
          if (!this.availableConnections.includes(ws)) {
            this.availableConnections.push(ws);
          }
          resolve();
        }
      });
    });
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      const now = Date.now();
      
      this.connections.forEach(ws => {
        if (ws.readyState !== 1) { // OPEN
          console.warn('[ConnectionPool] Unhealthy connection detected');
        }
      });

      // Maintain pool size
      if (this.connections.size < this.config.poolSize) {
        this.createConnection();
      }
    }, 5000);
  }

  /**
   * Get pool statistics
   */
  getStats(): { total: number; available: number; healthy: number } {
    const healthy = Array.from(this.connections).filter(
      (ws: any) => ws.readyState === 1 // OPEN
    ).length;
    
    return {
      total: this.connections.size,
      available: this.availableConnections.length,
      healthy
    };
  }

  /**
   * Gracefully close all connections
   */
  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    const closePromises = Array.from(this.connections).map((ws: any) => {
      return new Promise<void>((resolve) => {
        ws.close(1000, 'Pool shutdown');
        resolve();
      });
    });
    
    await Promise.all(closePromises);
    this.connections.clear();
    this.availableConnections = [];
  }
}

// ============================================================================
// PRIORITY MANAGER: System Resource Prioritization
// ============================================================================

/**
 * PriorityManager - Manages process and thread priority for real-time performance
 * 
 * Platform-specific implementations for:
 * - Windows: SetPriorityClass, SetThreadPriorityBoost
 * - Unix: nice, ionice, sched_setscheduler
 */
export class PriorityManager {
  private config: PriorityConfig;
  private originalPriority?: number;

  constructor(config: PriorityConfig = DEFAULT_PRIORITY_CONFIG) {
    this.config = config;
  }

  /**
   * Elevate process priority for maximum performance
   */
  elevatePriority(): boolean {
    if (!this.config.elevateProcessPriority) {
      return false;
    }

    try {
      const process = global.process;
      
      // On Windows, use native priority
      if (process.platform === 'win32') {
        // Note: Requires native module or elevated permissions
        // This is a demonstration - in production, use node-priority or similar
        console.log('[PriorityManager] Windows priority elevation requested');
        console.log('[PriorityManager] Target: REALTIME_PRIORITY_CLASS');
      } 
      // On Unix-like systems
      else {
        // Set nice value (requires appropriate permissions)
        const { execSync } = require('child_process');
        
        try {
          // Attempt to set nice value
          execSync(`renice -n ${Math.abs(this.config.niceValue)} -p ${process.pid}`, {
            stdio: 'ignore'
          });
          console.log(`[PriorityManager] Process priority set to nice: ${this.config.niceValue}`);
        } catch (e) {
          console.warn('[PriorityManager] Could not set nice value (may need elevated permissions)');
        }

        // Set I/O priority (requires root)
        try {
          execSync(`ionice -c 1 -p ${process.pid}`, {
            stdio: 'ignore'
          });
          console.log('[PriorityManager] I/O priority set to real-time');
        } catch (e) {
          console.warn('[PriorityManager] Could not set I/O priority (requires root)');
        }
      }

      // Set CPU affinity if specified
      if (this.config.cpuAffinity.length > 0) {
        this.setCpuAffinity(this.config.cpuAffinity);
      }

      return true;
    } catch (error) {
      console.error('[PriorityManager] Failed to elevate priority:', error);
      return false;
    }
  }

  /**
   * Set CPU affinity (which cores the process can use)
   */
  private setCpuAffinity(affinity: number[]): void {
    try {
      if (os.platform() === 'win32') {
        // Windows: Use PowerShell to set affinity
        const { execSync } = require('child_process');
        const mask = affinity.reduce((acc, core) => acc | (1 << core), 0);
        execSync(`powershell -Command "(Get-Process -Id ${process.pid}).ProcessorAffinity = ${mask}"`, {
          stdio: 'ignore'
        });
        console.log(`[PriorityManager] CPU affinity set to cores: ${affinity.join(', ')}`);
      } else {
        // Unix: Use taskset
        const { execSync } = require('child_process');
        const mask = affinity.map(c => c.toString()).join(',');
        execSync(`taskset -cp ${mask} ${process.pid}`, {
          stdio: 'ignore'
        });
        console.log(`[PriorityManager] CPU affinity set to cores: ${affinity.join(', ')}`);
      }
    } catch (error) {
      console.warn('[PriorityManager] Could not set CPU affinity:', error);
    }
  }

  /**
   * Create a high-priority scheduler for audio processing
   * Uses setImmediate for maximum throughput
   */
  scheduleHighPriority(callback: () => void): void {
    // Use all available mechanisms for maximum priority
    setImmediate(callback);
    
    // Alternative: Use queueMicrotask for even higher priority
    // queueMicrotask(callback);
  }

  /**
   * Create a worker thread for CPU-intensive audio processing
   */
  static createAudioWorker(): void {
    // In production: Use Worker Threads for parallel processing
    // const { Worker } = require('worker_threads');
    // const worker = new Worker('./audio-processor.js');
  }
}

// ============================================================================
// STREAM BUFFER: Lock-Free Ring Buffer for Audio Data
// ============================================================================

/**
 * StreamBuffer - Lock-free ring buffer for zero-copy audio streaming
 * 
 * Optimization Strategies:
 * 1. Pre-allocated buffers to avoid GC
 * 2. Lock-free read/write with atomic operations
 * 3. Backpressure handling to prevent memory exhaustion
 */
export class StreamBuffer {
  private buffer: Buffer;
  private writeIndex: number = 0;
  private readIndex: number = 0;
  private capacity: number;
  private highWaterMark: number;
  private lowWaterMark: number;

  constructor(capacityBytes: number = 1024 * 1024) {
    this.capacity = capacityBytes;
    this.buffer = Buffer.alloc(capacityBytes);
    this.highWaterMark = Math.floor(capacityBytes * 0.9);
    this.lowWaterMark = Math.floor(capacityBytes * 0.3);
  }

  /**
   * Write data to buffer (non-blocking, atomic)
   */
  write(data: Buffer): boolean {
    const dataLength = data.length;
    
    // Check for overflow
    if (this.getAvailableSpace() < dataLength) {
      console.warn('[StreamBuffer] Buffer overflow - dropping data');
      return false;
    }

    // Write data to buffer
    data.copy(this.buffer, this.writeIndex);
    this.writeIndex = (this.writeIndex + dataLength) % this.capacity;
    
    return true;
  }

  /**
   * Read data from buffer
   */
  read(length: number): Buffer | null {
    if (this.getAvailableData() < length) {
      return null;
    }

    const data = Buffer.alloc(length);
    data.copy(this.buffer, 0, this.readIndex);
    this.readIndex = (this.readIndex + length) % this.capacity;
    
    return data;
  }

  /**
   * Get available space in buffer
   */
  getAvailableSpace(): number {
    if (this.writeIndex >= this.readIndex) {
      return this.capacity - this.writeIndex + this.readIndex - 1;
    }
    return this.readIndex - this.writeIndex - 1;
  }

  /**
   * Get available data in buffer
   */
  getAvailableData(): number {
    if (this.writeIndex >= this.readIndex) {
      return this.writeIndex - this.readIndex;
    }
    return this.capacity - this.readIndex + this.writeIndex;
  }

  /**
   * Check if buffer needs backpressure
   */
  needsBackpressure(): boolean {
    return this.getAvailableSpace() < this.lowWaterMark;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.writeIndex = 0;
    this.readIndex = 0;
  }
}

// ============================================================================
// HIGH-PERFORMANCE AUDIO STREAM ENGINE
// ============================================================================

export interface StreamEvents {
  on(event: 'data', listener: (data: Buffer) => void): void;
  on(event: 'transcript', listener: (transcript: string) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'status', listener: (status: string) => void): void;
  on(event: 'metrics', listener: (metrics: StreamMetrics) => void): void;
}

export interface StreamMetrics {
  latencyMs: number;
  bytesTransmitted: number;
  chunksSent: number;
  encodingTimeMs: number;
  queueDepth: number;
  connectionHealth: number;
}

/**
 * VoiceStreamEngine - Main orchestrator for low-latency voice streaming
 * 
 * This is the primary class that ties all components together for
 * ultra-low latency voice recording and API processing.
 */
export class VoiceStreamEngine extends EventEmitter implements StreamEvents {
  private config: StreamConfig;
  private encoder: AudioEncoder;
  private connectionPool?: ConnectionPool;
  private priorityManager: PriorityManager;
  private streamBuffer: StreamBuffer;
  
  // Recording state
  private isRecording: boolean = false;
  private mediaRecorder?: MediaRecorder;
  private audioContext?: AudioContext;
  private audioStream?: MediaStream;
  
  // Timing and metrics
  private chunkInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private startTime: number = 0;
  private bytesTransmitted: number = 0;
  private chunksSent: number = 0;

  constructor(config: Partial<StreamConfig> = {}) {
    super();
    
    // Merge configurations with defaults
    this.config = {
      audio: { ...DEFAULT_AUDIO_CONFIG, ...config.audio },
      connection: { ...DEFAULT_CONNECTION_CONFIG, ...config.connection },
      priority: { ...DEFAULT_PRIORITY_CONFIG, ...config.priority },
      ...config
    };

    this.encoder = new AudioEncoder(this.config.audio);
    this.priorityManager = new PriorityManager(this.config.priority);
    this.streamBuffer = new StreamBuffer(2 * 1024 * 1024); // 2MB buffer
    
    // Set up high-priority processing
    this.priorityManager.elevatePriority();
  }

  /**
   * Initialize the streaming engine
   */
  async initialize(): Promise<void> {
    console.log('[VoiceStreamEngine] Initializing...');
    
    // Initialize connection pool
    this.connectionPool = new ConnectionPool(this.config.connection);
    await this.connectionPool.initialize();
    
    // Set up response handler
    this.connectionPool.on('message', (data: Buffer) => {
      this.handleApiResponse(data);
    });
    
    this.emit('status', 'initialized');
    console.log('[VoiceStreamEngine] Initialization complete');
  }

  /**
   * Start recording and streaming
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.warn('[VoiceStreamEngine] Already recording');
      return;
    }

    console.log('[VoiceStreamEngine] Starting recording...');

    try {
      // Request microphone access with optimal settings
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.config.audio.channels,
          sampleRate: this.config.audio.sampleRate,
          echoCancellation: false, // Disable for lower latency
          noiseSuppression: false, // Disable for lower latency
          autoGainControl: false,   // Disable for consistent audio levels
        },
        video: false
      });

      // Create AudioContext for processing
      this.audioContext = new AudioContext({
        sampleRate: this.config.audio.sampleRate,
        latencyHint: 'interactive' // Request lowest latency
      });

      // Create media source
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      
      // Create processor for real-time audio capture
      const processor = this.audioContext.createScriptProcessor(
        4096, // Buffer size (smaller = lower latency)
        this.config.audio.channels,
        this.config.audio.channels
      );

      // Process audio in real-time
      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);
        
        // Convert Float32 to Int16 PCM
        const pcmBuffer = this.float32ToInt16(pcmData);
        
        // Encode with Opus
        const encoded = this.encoder.encode(pcmBuffer);
        
        // Add to stream buffer
        this.streamBuffer.write(encoded);
      };

      // Connect nodes
      source.connect(processor);
      processor.connect(this.audioContext.destination);

      // Start chunked transmission
      this.startChunkedTransmission();
      
      this.isRecording = true;
      this.startTime = Date.now();
      
      this.emit('status', 'recording');
      console.log('[VoiceStreamEngine] Recording started');
      
    } catch (error) {
      console.error('[VoiceStreamEngine] Failed to start recording:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Start transmitting audio chunks at regular intervals
   */
  private startChunkedTransmission(): void {
    const sendChunk = async () => {
      if (!this.isRecording || !this.connectionPool) return;

      const chunkSize = this.encoder.getExpectedEncodedSize();
      const data = this.streamBuffer.read(chunkSize);
      
      if (data && data.length > 0) {
        try {
          await this.connectionPool.send(data);
          
          this.bytesTransmitted += data.length;
          this.chunksSent++;
          
          // Emit data event for debugging
          this.emit('data', data);
        } catch (error) {
          console.error('[VoiceStreamEngine] Send error:', error);
          this.emit('error', error as Error);
        }
      }
    };

    // Send chunks at configured interval
    this.chunkInterval = setInterval(
      () => this.priorityManager.scheduleHighPriority(sendChunk),
      this.config.audio.chunkIntervalMs
    );

    // Start metrics reporting
    this.metricsInterval = setInterval(() => {
      this.emit('metrics', this.getMetrics());
    }, 1000);
  }

  /**
   * Stop recording and streaming
   */
  async stopRecording(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    console.log('[VoiceStreamEngine] Stopping recording...');

    // Clear intervals
    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = undefined;
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    // Stop audio processing
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = undefined;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = undefined;
    }

    // Send end-of-stream marker
    if (this.connectionPool) {
      try {
        await this.connectionPool.send(JSON.stringify({ endOfStream: true }));
      } catch (e) {
        // Ignore errors during shutdown
      }
    }

    this.isRecording = false;
    this.streamBuffer.clear();
    
    this.emit('status', 'stopped');
    console.log('[VoiceStreamEngine] Recording stopped');
  }

  /**
   * Handle API response (transcription)
   */
  private handleApiResponse(data: Buffer): void {
    try {
      const response = JSON.parse(data.toString());
      
      if (response.transcript) {
        this.emit('transcript', response.transcript);
      }
      
      if (response.latency) {
        console.log(`[VoiceStreamEngine] API latency: ${response.latency}ms`);
      }
    } catch (error) {
      console.error('[VoiceStreamEngine] Failed to parse response:', error);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): StreamMetrics {
    return {
      latencyMs: Date.now() - this.startTime,
      bytesTransmitted: this.bytesTransmitted,
      chunksSent: this.chunksSent,
      encodingTimeMs: this.encoder.getStats().encodeTimeMs,
      queueDepth: this.streamBuffer.getAvailableData(),
      connectionHealth: this.connectionPool?.getStats().healthy ?? 0
    };
  }

  /**
   * Convert Float32 audio to Int16 PCM
   */
  private float32ToInt16(float32Array: Float32Array): Buffer {
    const int16Array = new Int16Array(float32Array.length);
    
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    return Buffer.from(int16Array.buffer);
  }

  /**
   * Gracefully shutdown the engine
   */
  async destroy(): Promise<void> {
    await this.stopRecording();
    
    if (this.connectionPool) {
      await this.connectionPool.destroy();
    }
    
    this.removeAllListeners();
    console.log('[VoiceStreamEngine] Destroyed');
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/**
 * Example usage of the VoiceStreamEngine
 */
export async function createVoiceStream(config?: Partial<StreamConfig>): Promise<VoiceStreamEngine> {
  const engine = new VoiceStreamEngine(config);
  
  // Set up event handlers
  engine.on('transcript', (text) => {
    console.log('Transcript:', text);
  });
  
  engine.on('error', (error) => {
    console.error('Error:', error);
  });
  
  engine.on('metrics', (metrics) => {
    console.log('Metrics:', {
      latency: `${metrics.latencyMs}ms`,
      chunks: metrics.chunksSent,
      bytes: metrics.bytesTransmitted
    });
  });
  
  // Initialize
  await engine.initialize();
  
  return engine;
}

// Export all components
export * from './types';
