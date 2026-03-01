/**
 * Performance Monitor - Real-time metrics collection and analysis
 * 
 * Provides detailed performance metrics for the streaming pipeline:
 * - Latency tracking (capture to API submission)
 * - Throughput analysis
 * - Connection health monitoring
 * - Buffer utilization tracking
 */

import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  /** Timestamp of measurement */
  timestamp: number;
  /** Audio capture latency (ms) */
  captureLatencyMs: number;
  /** Encoding latency (ms) */
  encodingLatencyMs: number;
  /** Transmission latency (ms) */
  transmissionLatencyMs: number;
  /** API response latency (ms) */
  apiLatencyMs: number;
  /** Total end-to-end latency (ms) */
  totalLatencyMs: number;
  /** Bytes per second transmitted */
  throughputBps: number;
  /** Chunks per second */
  chunksPerSecond: number;
  /** Dropped chunks count */
  droppedChunks: number;
  /** Buffer utilization (0-1) */
  bufferUtilization: number;
  /** CPU usage estimate */
  cpuUsage: number;
  /** Memory usage in MB */
  memoryUsageMb: number;
}

export interface PerformanceThresholds {
  /** Maximum acceptable total latency (ms) */
  maxLatencyMs: number;
  /** Maximum acceptable API latency (ms) */
  maxApiLatencyMs: number;
  /** Maximum buffer utilization (0-1) */
  maxBufferUtilization: number;
  /** Minimum acceptable throughput (bytes/sec) */
  minThroughputBps: number;
}

export interface PerformanceReport {
  /** Time window of the report */
  windowStart: number;
  windowEnd: number;
  /** Average metrics over the window */
  average: PerformanceMetrics;
  /** Minimum metrics over the window */
  minimum: PerformanceMetrics;
  /** Maximum metrics over the window */
  maximum: PerformanceMetrics;
  /** P95 metrics (95th percentile) */
  p95: PerformanceMetrics;
  /** P99 metrics (99th percentile) */
  p99: PerformanceMetrics;
  /** Number of threshold violations */
  violations: number;
  /** Overall health score (0-100) */
  healthScore: number;
}

/**
 * PerformanceMonitor - Real-time performance tracking
 * 
 * Tracks all aspects of the streaming pipeline for optimization
 * and debugging purposes.
 */
export class PerformanceMonitor extends EventEmitter {
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize: number;
  private sampleInterval?: NodeJS.Timeout;
  private startTime: number;
  private bytesTransmitted: number = 0;
  private chunksSent: number = 0;
  private chunksDropped: number = 0;
  private lastTimestamp: number = 0;
  private lastBytes: number = 0;
  private lastChunks: number = 0;
  
  private thresholds: PerformanceThresholds = {
    maxLatencyMs: 100,
    maxApiLatencyMs: 50,
    maxBufferUtilization: 0.9,
    minThroughputBps: 1000
  };
  
  private violationCount: number = 0;
  private systemMetricsInterval?: NodeJS.Timeout;

  constructor(maxHistorySize: number = 1000) {
    super();
    this.maxHistorySize = maxHistorySize;
    this.startTime = Date.now();
    this.lastTimestamp = this.startTime;
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Record a metrics sample
   */
  recordMetrics(metrics: Partial<PerformanceMetrics>): void {
    const fullMetrics: PerformanceMetrics = {
      timestamp: Date.now(),
      captureLatencyMs: metrics.captureLatencyMs ?? 0,
      encodingLatencyMs: metrics.encodingLatencyMs ?? 0,
      transmissionLatencyMs: metrics.transmissionLatencyMs ?? 0,
      apiLatencyMs: metrics.apiLatencyMs ?? 0,
      totalLatencyMs: metrics.totalLatencyMs ?? 0,
      throughputBps: metrics.throughputBps ?? 0,
      chunksPerSecond: metrics.chunksPerSecond ?? 0,
      droppedChunks: metrics.droppedChunks ?? 0,
      bufferUtilization: metrics.bufferUtilization ?? 0,
      cpuUsage: metrics.cpuUsage ?? 0,
      memoryUsageMb: metrics.memoryUsageMb ?? 0
    };

    // Check thresholds
    this.checkThresholds(fullMetrics);

    // Add to history
    this.metricsHistory.push(fullMetrics);
    
    // Trim history if needed
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    this.emit('metrics', fullMetrics);
  }

  /**
   * Check if metrics violate thresholds
   */
  private checkThresholds(metrics: PerformanceMetrics): void {
    if (metrics.totalLatencyMs > this.thresholds.maxLatencyMs) {
      this.violationCount++;
      this.emit('thresholdViolation', { type: 'latency', value: metrics.totalLatencyMs, threshold: this.thresholds.maxLatencyMs });
    }

    if (metrics.bufferUtilization > this.thresholds.maxBufferUtilization) {
      this.violationCount++;
      this.emit('thresholdViolation', { type: 'buffer', value: metrics.bufferUtilization, threshold: this.thresholds.maxBufferUtilization });
    }

    if (metrics.throughputBps < this.thresholds.minThroughputBps && metrics.throughputBps > 0) {
      this.violationCount++;
      this.emit('thresholdViolation', { type: 'throughput', value: metrics.throughputBps, threshold: this.thresholds.minThroughputBps });
    }
  }

  /**
   * Update transmission stats
   */
  updateTransmission(bytes: number, chunks: number, dropped: number = 0): void {
    this.bytesTransmitted += bytes;
    this.chunksSent += chunks;
    this.chunksDropped += dropped;
  }

  /**
   * Get current throughput
   */
  getCurrentThroughput(): { bps: number; cps: number } {
    const now = Date.now();
    const elapsed = (now - this.lastTimestamp) / 1000;
    
    if (elapsed <= 0) return { bps: 0, cps: 0 };
    
    const bps = (this.bytesTransmitted - this.lastBytes) / elapsed;
    const cps = (this.chunksSent - this.lastChunks) / elapsed;
    
    this.lastTimestamp = now;
    this.lastBytes = this.bytesTransmitted;
    this.lastChunks = this.chunksSent;
    
    return { bps, cps };
  }

  /**
   * Generate a performance report
   */
  generateReport(windowMs: number = 60000): PerformanceReport {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    const windowMetrics = this.metricsHistory.filter(m => m.timestamp >= windowStart);
    
    if (windowMetrics.length === 0) {
      return this.emptyReport(windowStart, now);
    }

    const values = (key: keyof PerformanceMetrics): number[] => 
      windowMetrics.map(m => m[key] as number).filter(v => typeof v === 'number');

    const avg = (key: keyof PerformanceMetrics): number => {
      const v = values(key);
      return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    };

    const min = (key: keyof PerformanceMetrics): number => {
      const v = values(key);
      return v.length > 0 ? Math.min(...v) : 0;
    };

    const max = (key: keyof PerformanceMetrics): number => {
      const v = values(key);
      return v.length > 0 ? Math.max(...v) : 0;
    };

    const percentile = (key: keyof PerformanceMetrics, p: number): number => {
      const v = values(key).sort((a, b) => a - b);
      if (v.length === 0) return 0;
      const idx = Math.floor(v.length * p);
      return v[Math.min(idx, v.length - 1)];
    };

    const healthScore = this.calculateHealthScore(windowMetrics);

    return {
      windowStart,
      windowEnd: now,
      average: {
        timestamp: now,
        captureLatencyMs: avg('captureLatencyMs'),
        encodingLatencyMs: avg('encodingLatencyMs'),
        transmissionLatencyMs: avg('transmissionLatencyMs'),
        apiLatencyMs: avg('apiLatencyMs'),
        totalLatencyMs: avg('totalLatencyMs'),
        throughputBps: avg('throughputBps'),
        chunksPerSecond: avg('chunksPerSecond'),
        droppedChunks: avg('droppedChunks'),
        bufferUtilization: avg('bufferUtilization'),
        cpuUsage: avg('cpuUsage'),
        memoryUsageMb: avg('memoryUsageMb')
      },
      minimum: {
        timestamp: now,
        captureLatencyMs: min('captureLatencyMs'),
        encodingLatencyMs: min('encodingLatencyMs'),
        transmissionLatencyMs: min('transmissionLatencyMs'),
        apiLatencyMs: min('apiLatencyMs'),
        totalLatencyMs: min('totalLatencyMs'),
        throughputBps: min('throughputBps'),
        chunksPerSecond: min('chunksPerSecond'),
        droppedChunks: min('droppedChunks'),
        bufferUtilization: min('bufferUtilization'),
        cpuUsage: min('cpuUsage'),
        memoryUsageMb: min('memoryUsageMb')
      },
      maximum: {
        timestamp: now,
        captureLatencyMs: max('captureLatencyMs'),
        encodingLatencyMs: max('encodingLatencyMs'),
        transmissionLatencyMs: max('transmissionLatencyMs'),
        apiLatencyMs: max('apiLatencyMs'),
        totalLatencyMs: max('totalLatencyMs'),
        throughputBps: max('throughputBps'),
        chunksPerSecond: max('chunksPerSecond'),
        droppedChunks: max('droppedChunks'),
        bufferUtilization: max('bufferUtilization'),
        cpuUsage: max('cpuUsage'),
        memoryUsageMb: max('memoryUsageMb')
      },
      p95: {
        timestamp: now,
        captureLatencyMs: percentile('captureLatencyMs', 0.95),
        encodingLatencyMs: percentile('encodingLatencyMs', 0.95),
        transmissionLatencyMs: percentile('transmissionLatencyMs', 0.95),
        apiLatencyMs: percentile('apiLatencyMs', 0.95),
        totalLatencyMs: percentile('totalLatencyMs', 0.95),
        throughputBps: percentile('throughputBps', 0.95),
        chunksPerSecond: percentile('chunksPerSecond', 0.95),
        droppedChunks: percentile('droppedChunks', 0.95),
        bufferUtilization: percentile('bufferUtilization', 0.95),
        cpuUsage: percentile('cpuUsage', 0.95),
        memoryUsageMb: percentile('memoryUsageMb', 0.95)
      },
      p99: {
        timestamp: now,
        captureLatencyMs: percentile('captureLatencyMs', 0.99),
        encodingLatencyMs: percentile('encodingLatencyMs', 0.99),
        transmissionLatencyMs: percentile('transmissionLatencyMs', 0.99),
        apiLatencyMs: percentile('apiLatencyMs', 0.99),
        totalLatencyMs: percentile('totalLatencyMs', 0.99),
        throughputBps: percentile('throughputBps', 0.99),
        chunksPerSecond: percentile('chunksPerSecond', 0.99),
        droppedChunks: percentile('droppedChunks', 0.99),
        bufferUtilization: percentile('bufferUtilization', 0.99),
        cpuUsage: percentile('cpuUsage', 0.99),
        memoryUsageMb: percentile('memoryUsageMb', 0.99)
      },
      violations: this.violationCount,
      healthScore
    };
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    let score = 100;
    
    // Latency penalty
    const avgLatency = metrics.reduce((sum, m) => sum + m.totalLatencyMs, 0) / metrics.length;
    if (avgLatency > 50) score -= 20;
    if (avgLatency > 100) score -= 30;
    
    // Buffer utilization penalty
    const maxBuffer = Math.max(...metrics.map(m => m.bufferUtilization));
    if (maxBuffer > 0.7) score -= 15;
    if (maxBuffer > 0.9) score -= 25;
    
    // Dropped chunks penalty
    const totalDropped = metrics.reduce((sum, m) => sum + m.droppedChunks, 0);
    if (totalDropped > 10) score -= 20;
    
    // Throughput penalty
    const avgThroughput = metrics.reduce((sum, m) => sum + m.throughputBps, 0) / metrics.length;
    if (avgThroughput < 2000) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate empty report
   */
  private emptyReport(windowStart: number, windowEnd: number): PerformanceReport {
    return {
      windowStart,
      windowEnd,
      average: this.emptyMetrics(),
      minimum: this.emptyMetrics(),
      maximum: this.emptyMetrics(),
      p95: this.emptyMetrics(),
      p99: this.emptyMetrics(),
      violations: 0,
      healthScore: 0
    };
  }

  /**
   * Generate empty metrics
   */
  private emptyMetrics(): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      captureLatencyMs: 0,
      encodingLatencyMs: 0,
      transmissionLatencyMs: 0,
      apiLatencyMs: 0,
      totalLatencyMs: 0,
      throughputBps: 0,
      chunksPerSecond: 0,
      droppedChunks: 0,
      bufferUtilization: 0,
      cpuUsage: 0,
      memoryUsageMb: 0
    };
  }

  /**
   * Start periodic metrics collection
   */
  startCollection(intervalMs: number = 1000): void {
    this.stopCollection();
    
    this.sampleInterval = setInterval(() => {
      const throughput = this.getCurrentThroughput();
      
      this.recordMetrics({
        throughputBps: throughput.bps,
        chunksPerSecond: throughput.cps,
        droppedChunks: this.chunksDropped
      });
    }, intervalMs);
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = undefined;
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metricsHistory = [];
    this.bytesTransmitted = 0;
    this.chunksSent = 0;
    this.chunksDropped = 0;
    this.violationCount = 0;
    this.startTime = Date.now();
    this.lastTimestamp = this.startTime;
    this.lastBytes = 0;
    this.lastChunks = 0;
  }

  /**
   * Get metrics history
   */
  getHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get current stats summary
   */
  getSummary(): {
    uptime: number;
    totalBytes: number;
    totalChunks: number;
    totalDropped: number;
    violations: number;
  } {
    return {
      uptime: Date.now() - this.startTime,
      totalBytes: this.bytesTransmitted,
      totalChunks: this.chunksSent,
      totalDropped: this.chunksDropped,
      violations: this.violationCount
    };
  }
}
