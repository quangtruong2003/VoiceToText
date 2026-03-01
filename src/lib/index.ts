/**
 * Voice Stream Engine - Main Export
 * 
 * High-Performance, Ultra-Low Latency Voice Recording & API Processing
 * 
 * @packageDocumentation
 */

// Core engine
export { 
  VoiceStreamEngine, 
  createVoiceStream,
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_CONNECTION_CONFIG,
  DEFAULT_PRIORITY_CONFIG
} from './voice-stream-engine';

export type { 
  AudioConfig, 
  ConnectionConfig, 
  PriorityConfig, 
  StreamConfig,
  StreamEvents,
  StreamMetrics
} from './voice-stream-engine';

// Audio components
export { AudioEncoder } from './voice-stream-engine';

// Connection management
export { ConnectionPool } from './voice-stream-engine';

// Priority management
export { PriorityManager } from './voice-stream-engine';

// Stream buffer
export { StreamBuffer } from './voice-stream-engine';

// HTTP/2 streaming
export { 
  Http2StreamClient, 
  GrpcAudioStream,
  ChunkedHttpStream,
  createHttp2Agent
} from './http2-stream';

export type {
  Http2StreamConfig,
  GrpcStreamConfig,
  ChunkedStreamConfig
} from './http2-stream';

// Types
export type {
  AudioChunk,
  TranscriptionResult,
  StreamStatistics,
  ConnectionState,
  AudioDeviceInfo,
  StreamOptions,
  WorkerMessage,
  WorkerResponse,
  StreamProtocolMessage,
  AudioMessagePayload,
  TranscriptMessagePayload
} from './types';

// Performance monitoring
export { PerformanceMonitor } from './performance-monitor';
export type {
  PerformanceMetrics,
  PerformanceThresholds,
  PerformanceReport
} from './performance-monitor';

// Server-side processing
export {
  VoiceProcessingServer,
  TranscriptionEngine,
  WebSocketStreamHandler,
  Http2StreamHandler,
  RestApiHandler,
  createVoiceServer,
  DEFAULT_SERVER_CONFIG
} from './voice-server';

export type {
  ServerConfig,
  TranscriptionRequest,
  TranscriptionResponse
} from './voice-server';
