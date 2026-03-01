/**
 * HTTP/2 Multiplexed Stream Client
 * 
 * Provides HTTP/2 support for scenarios where WebSocket is not available
 * Uses multiplexed streams for concurrent audio transmission
 */

import * as http2 from 'http2';
import { EventEmitter } from 'events';

export interface Http2StreamConfig {
  /** HTTP/2 endpoint URL */
  endpoint: string;
  /** Number of concurrent streams */
  maxConcurrentStreams: number;
  /** Connection timeout */
  connectionTimeout: number;
  /** Enable TLS */
  secure: boolean;
  /** API key for authentication */
  apiKey?: string;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Http2StreamClient - HTTP/2 multiplexed streaming client
 * 
 * Advantages over WebSocket:
 * 1. Native multiplexed streams (no connection limit)
 * 2. Better TLS handshake resumption
 * 3. Native flow control
 * 4. Better proxy/load balancer support
 */
export class Http2StreamClient extends EventEmitter {
  private config: Http2StreamConfig;
  private client?: http2.ClientHttp2Session;
  private streams: Map<number, http2.ClientHttp2Stream> = new Map();
  private streamCounter: number = 0;
  private connected: boolean = false;
  private connectPromise?: Promise<void>;

  constructor(config: Http2StreamConfig) {
    super();
    this.config = {
      maxConcurrentStreams: 10,
      connectionTimeout: 5000,
      secure: true,
      ...config
    };
  }

  /**
   * Connect to HTTP/2 server
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      const url = new URL(this.config.endpoint);
      const protocol = this.config.secure ? 'https:' : 'http:';

      const client = http2.connect(`${protocol}//${url.host}`, {
        maxConcurrentStreams: this.config.maxConcurrentStreams,
        peerMaxConcurrentStreams: this.config.maxConcurrentStreams,
      });

      client.on('connect', () => {
        this.connected = true;
        this.client = client;
        console.log('[Http2StreamClient] Connected');
        this.emit('connected');
        resolve();
      });

      client.on('error', (err) => {
        console.error('[Http2StreamClient] Client error:', err);
        this.emit('error', err);
        reject(err);
      });

      client.on('close', () => {
        this.connected = false;
        console.log('[Http2StreamClient] Connection closed');
        this.emit('close');
      });

      // Connection timeout
      setTimeout(() => {
        if (!this.connected) {
          client.close();
          reject(new Error('Connection timeout'));
        }
      }, this.config.connectionTimeout);
    });

    return this.connectPromise;
  }

  /**
   * Send audio data through an HTTP/2 stream
   */
  async sendAudio(audioData: Buffer, metadata?: any): Promise<void> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected');
    }

    const url = new URL(this.config.endpoint);
    const path = url.pathname || '/stream/audio';

    return new Promise((resolve, reject) => {
      const headers: http2.OutgoingHttpHeaders = {
        ':method': 'POST',
        ':path': path,
        ':scheme': this.config.secure ? 'https' : 'http',
        ':authority': url.host,
        'content-type': 'application/octet-stream',
        'x-audio-timestamp': Date.now().toString(),
        'x-sequence': (++this.streamCounter).toString(),
        ...(this.config.apiKey && { 'authorization': `Bearer ${this.config.apiKey}` }),
        ...this.config.headers,
        ...metadata
      };

      const stream = this.client!.request(headers);

      const streamId = stream.id;
      this.streams.set(streamId, stream);

      stream.on('response', (headers) => {
        this.emit('response', headers, streamId);
      });

      stream.on('data', (chunk) => {
        this.emit('audioData', chunk, streamId);
      });

      stream.on('end', () => {
        this.streams.delete(streamId);
        this.emit('streamEnd', streamId);
      });

      stream.on('error', (err) => {
        this.streams.delete(streamId);
        this.emit('streamError', err, streamId);
        reject(err);
      });

      stream.end(audioData, () => {
        resolve();
      });
    });
  }

  /**
   * Open a bidirectional stream for streaming transcription
   */
  async openTranscriptionStream(): Promise<http2.ClientHttp2Stream> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected');
    }

    const url = new URL(this.config.endpoint);

    const headers: http2.OutgoingHttpHeaders = {
      ':method': 'POST',
      ':path': '/stream/transcribe',
      ':scheme': this.config.secure ? 'https' : 'http',
      ':authority': url.host,
      'content-type': 'application/octet-stream',
      'accept': 'application/json',
      ...(this.config.apiKey && { 'authorization': `Bearer ${this.config.apiKey}` }),
    };

    const stream = this.client.request(headers);
    const streamId = stream.id;
    this.streams.set(streamId, stream);

    stream.on('response', (headers) => {
      console.log('[Http2StreamClient] Stream response:', headers);
    });

    stream.on('data', (chunk) => {
      try {
        const data = JSON.parse(chunk.toString());
        this.emit('transcript', data);
      } catch (e) {
        this.emit('rawData', chunk);
      }
    });

    stream.on('error', (err) => {
      this.streams.delete(streamId);
      this.emit('streamError', err, streamId);
    });

    stream.on('close', () => {
      this.streams.delete(streamId);
    });

    return stream;
  }

  /**
   * Get connection statistics
   */
  getStats(): { connected: boolean; activeStreams: number } {
    return {
      connected: this.connected,
      activeStreams: this.streams.size
    };
  }

  /**
   * Close the client
   */
  async close(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.connected = false;
    }
  }
}

/**
 * Create optimized HTTP/2 agent with connection pooling
 */
export function createHttp2Agent(config: {
  maxSessions?: number;
  keepAlive?: boolean;
  keepAliveTimeout?: number;
}): http2.SecureClientSessionOptions {
  return {
    maxSessionRedirects: 3,
    maxConcurrentStreams: config.maxSessions || 10,
    settings: {
      headerTableSize: 4096,
      maxConcurrentStreams: config.maxSessions || 10,
      initialWindowSize: 65535,
      maxFrameSize: 16384,
      maxHeaderListSize: 4096,
      enablePush: false,
    },
  };
}

// ============================================================================
// gRPC Streaming Support (Alternative to WebSocket)
// ============================================================================

/**
 * gRPC Stream Client for ultra-low latency audio streaming
 * 
 * Note: Requires @grpc/grpc-js package
 * This is a lightweight wrapper demonstrating the architecture
 */

export interface GrpcStreamConfig {
  /** gRPC server address */
  address: string;
  /** Service name */
  service: string;
  /** Enable TLS */
  secure: boolean;
  /** Metadata for authentication */
  metadata?: Record<string, string>;
}

/**
 * GrpcAudioStream - gRPC-based audio streaming
 * 
 * Advantages:
 * 1. Protocol buffers for efficient serialization
 * 2. HTTP/2 under the hood (multiplexed streams)
 * 3. Strong typing with generated code
 * 4. Bidirectional streaming support
 * 
 * This is a placeholder implementation - production would use
 * actual gRPC generated code from .proto files
 */
export class GrpcAudioStream extends EventEmitter {
  private config: GrpcStreamConfig;
  private connected: boolean = false;
  private stream?: any; // Would be actual gRPC stream in production

  constructor(config: GrpcStreamConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to gRPC server
   */
  async connect(): Promise<void> {
    // In production:
    // const grpc = require('@grpc/grpc-js');
    // const protoLoader = require('@grpc/proto-loader');
    // const packageDefinition = protoLoader.loadSync(PROTO_PATH);
    // const proto = grpc.loadPackageDefinition(packageDefinition);
    // const client = new proto.StreamService(this.config.address, credentials);
    
    console.log('[GrpcAudioStream] Would connect to:', this.config.address);
    this.connected = true;
    this.emit('connected');
  }

  /**
   * Stream audio data
   */
  async streamAudio(audioData: Buffer, metadata?: any): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    
    // In production: this.stream.write({ audioData, metadata });
    this.emit('data', audioData);
  }

  /**
   * Get transcription response
   */
  onTranscription(callback: (transcript: string, isFinal: boolean) => void): void {
    this.on('transcript', callback);
  }

  /**
   * Close the stream
   */
  async close(): Promise<void> {
    // In production: await this.stream.end();
    this.connected = false;
    this.emit('close');
  }
}

// ============================================================================
// Chunked HTTP Streaming (Fallback for environments without WebSocket/gRPC)
// ============================================================================

/**
 * ChunkedHttpStream - HTTP chunked transfer streaming
 * 
 * Fallback streaming method for environments where WebSocket/gRPC
 * is not available. Uses Server-Sent Events (SSE) for responses.
 */

export interface ChunkedStreamConfig {
  /** HTTP endpoint */
  endpoint: string;
  /** API key */
  apiKey?: string;
  /** Headers */
  headers?: Record<string, string>;
  /** Request timeout */
  timeout: number;
}

export class ChunkedHttpStream extends EventEmitter {
  private config: ChunkedStreamConfig;
  private controller?: AbortController;
  private isStreaming: boolean = false;

  constructor(config: ChunkedStreamConfig) {
    super();
    this.config = {
      timeout: 30000,
      ...config
    };
  }

  /**
   * Start chunked streaming
   */
  async startStream(): Promise<void> {
    if (this.isStreaming) return;

    this.controller = new AbortController();
    this.isStreaming = true;

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Accept': 'text/event-stream',
          'Transfer-Encoding': 'chunked',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
          ...this.config.headers
        },
        body: this.controller.signal,
        signal: this.controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete chunks (separated by newline)
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              this.emit('transcript', parsed);
            } catch (e) {
              // Not JSON, emit as raw
              this.emit('rawData', data);
            }
          }
        }
      }

      this.emit('streamEnd');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.emit('error', error);
      }
    } finally {
      this.isStreaming = false;
    }
  }

  /**
   * Send audio chunk
   */
  async sendChunk(audioData: Buffer): Promise<void> {
    // In chunked streaming, this would be handled differently
    // This is a placeholder for the architecture
    this.emit('chunkSent', audioData.length);
  }

  /**
   * Stop streaming
   */
  stop(): void {
    if (this.controller) {
      this.controller.abort();
    }
    this.isStreaming = false;
  }
}
