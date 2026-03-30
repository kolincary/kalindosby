interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PerformanceSummary {
  totalMetrics: number;
  averageLoadTime: number;
  averageQueryTime: number;
  averageRenderTime: number;
  slowestOperation: PerformanceMetric | null;
  recentMetrics: PerformanceMetric[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000;

  recordMetric(name: string, duration: number, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    if (duration > 1000) {
      console.warn(`⚠️ Slow operation detected: ${name} took ${duration.toFixed(2)}ms`, metadata);
    }
  }

  measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const start = performance.now();
    return fn().then(result => {
      const duration = performance.now() - start;
      this.recordMetric(name, duration, metadata);
      return result;
    }).catch(error => {
      const duration = performance.now() - start;
      this.recordMetric(`${name} (ERROR)`, duration, { ...metadata, error: error.message });
      throw error;
    });
  }

  measure<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name} (ERROR)`, duration, {
        ...metadata,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  getSummary(): PerformanceSummary {
    const recentMetrics = this.metrics.slice(-50);
    const loadMetrics = this.metrics.filter(m => m.name.includes('load'));
    const queryMetrics = this.metrics.filter(m => m.name.includes('query'));
    const renderMetrics = this.metrics.filter(m => m.name.includes('render'));

    const avg = (metrics: PerformanceMetric[]): number => {
      if (metrics.length === 0) return 0;
      return metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    };

    const slowest = this.metrics.reduce((prev, current) =>
      current.duration > prev.duration ? current : prev,
      this.metrics[0] || { name: 'N/A', duration: 0, timestamp: 0 }
    );

    return {
      totalMetrics: this.metrics.length,
      averageLoadTime: avg(loadMetrics),
      averageQueryTime: avg(queryMetrics),
      averageRenderTime: avg(renderMetrics),
      slowestOperation: slowest,
      recentMetrics,
    };
  }

  clear(): void {
    this.metrics = [];
  }

  export(): string {
    return JSON.stringify(this.metrics, null, 2);
  }
}

export const performanceMonitor = new PerformanceMonitor();
