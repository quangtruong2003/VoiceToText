/**
 * Voice Stream Engine - Main Export
 *
 * High-Performance, Ultra-Low Latency Voice Recording & API Processing
 *
 * @packageDocumentation
 */

// Types - only export types that are actually used
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
