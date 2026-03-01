/**
 * Type definitions for the Voice Stream Engine
 */

// Additional types for the streaming system
export interface AudioChunk {
  /** Timestamp when chunk was captured */
  timestamp: number;
  /** Audio data in bytes */
  data: Buffer;
  /** Duration of audio in milliseconds */
  durationMs: number;
  /** Sequence number for ordering */
  sequenceNumber: number;
}

export interface TranscriptionResult {
  /** The transcribed text */
  text: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether this is a final result or partial */
  isFinal: boolean;
  /** Timestamp of the result */
  timestamp: number;
  /** Latency in milliseconds */
  latencyMs: number;
}

export interface StreamStatistics {
  /** Total bytes transmitted */
  bytesTransmitted: number;
  /** Number of chunks sent */
  chunksSent: number;
  /** Number of chunks received */
  chunksReceived: number;
  /** Average latency in milliseconds */
  avgLatencyMs: number;
  /** Current connection pool health */
  poolHealth: number;
  /** Encoder statistics */
  encoderStats: {
    encodeTimeMs: number;
    totalBytesEncoded: number;
    compressionRatio: number;
  };
  /** Buffer statistics */
  bufferStats: {
    availableSpace: number;
    availableData: number;
    utilizationPercent: number;
  };
}

export interface ConnectionState {
  /** Unique connection identifier */
  id: string;
  /** Connection status */
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  /** Last activity timestamp */
  lastActivity: number;
  /** Number of messages sent */
  messagesSent: number;
  /** Number of messages received */
  messagesReceived: number;
  /** Round-trip time in milliseconds */
  rttMs: number;
}

export interface AudioDeviceInfo {
  /** Device identifier */
  deviceId: string;
  /** Human-readable label */
  label: string;
  /** Whether this is the default device */
  isDefault: boolean;
  /** Supported sample rates */
  sampleRates: number[];
  /** Number of channels */
  channelCount: number;
}

// Local type definitions (duplicated to avoid circular deps)
export interface AudioConfig {
  sampleRate: number;
  channels: number;
  opusApplication: 'voip' | 'audio' | 'lowdelay';
  opusBitrate: number;
  opusFrameSize: number;
  chunkIntervalMs: number;
}

export interface ConnectionConfig {
  endpoint: string;
  useHttp2: boolean;
  poolSize: number;
  connectionTimeout: number;
  useTlsSessionResumption: boolean;
  pingInterval: number;
}

export interface PriorityConfig {
  elevateProcessPriority: boolean;
  niceValue: number;
  ioPriority: number;
  cpuAffinity: number[];
}

export interface StreamOptions {
  /** API endpoint URL */
  endpoint: string;
  /** API key for authentication */
  apiKey?: string;
  /** Custom HTTP headers */
  headers?: Record<string, string>;
  /** Audio configuration */
  audio?: Partial<AudioConfig>;
  /** Connection configuration */
  connection?: Partial<ConnectionConfig>;
  /** Priority configuration */
  priority?: Partial<PriorityConfig>;
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in milliseconds */
  reconnectDelay?: number;
}

// Worker thread message types
export interface WorkerMessage {
  type: 'encode' | 'decode' | 'process';
  data: Buffer;
  id: string;
}

export interface WorkerResponse {
  type: 'result' | 'error';
  data?: Buffer;
  error?: string;
  id: string;
}

// Protocol message types for WebSocket communication
export interface StreamProtocolMessage {
  /** Message type */
  type: 'audio' | 'transcript' | 'control' | 'ping' | 'pong';
  /** Message payload */
  payload: any;
  /** Sequence number */
  sequence: number;
  /** Timestamp */
  timestamp: number;
}

export interface AudioMessagePayload {
  /** Encoded audio data */
  audio: Buffer;
  /** Sample rate */
  sampleRate: number;
  /** Channels */
  channels: number;
  /** Format */
  format: 'opus' | 'pcm' | 'webm';
  /** Duration in ms */
  durationMs: number;
}

export interface TranscriptMessagePayload {
  /** Transcribed text */
  text: string;
  /** Confidence */
  confidence: number;
  /** Is final */
  isFinal: boolean;
  /** Start time in ms */
  startTime: number;
  /** End time in ms */
  endTime: number;
}
