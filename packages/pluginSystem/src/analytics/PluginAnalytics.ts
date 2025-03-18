import { EventEmitter } from 'events';
import { PluginType } from '../core/types';

export interface ExecutionMetrics {
  pluginId: string;
  methodName: string;
  startTime: number;
  endTime: number;
  success: boolean;
  error?: Error;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
}

export interface PluginStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  lastExecutionTime: number;
  errorRate: number;
  methodStats: Record<string, {
    executions: number;
    failures: number;
    totalTime: number;
    averageTime: number;
  }>;
  memoryUsage: {
    averageHeapUsed: number;
    peakHeapUsed: number;
  };
  cpuUsage: {
    averageUserTime: number;
    averageSystemTime: number;
  };
}

export interface AnalyticsSnapshot {
  timestamp: number;
  plugins: Record<string, PluginStats>;
  systemMetrics: {
    totalPlugins: number;
    activePlugins: number;
    totalExecutions: number;
    globalErrorRate: number;
    averageResponseTime: number;
  };
}

export class PluginAnalytics extends EventEmitter {
  private metrics: Map<string, PluginStats> = new Map();
  private readonly snapshotInterval: number = 60000; // 1 minute
  private snapshots: AnalyticsSnapshot[] = [];
  private readonly maxSnapshots: number = 1440; // 24 hours worth of minute snapshots

  constructor() {
    super();
    this.startSnapshotCollection();
  }

  recordExecution(metrics: ExecutionMetrics): void {
    const stats = this.getOrCreateStats(metrics.pluginId);
    const methodStats = this.getOrCreateMethodStats(stats, metrics.methodName);

    // Update execution counts
    stats.totalExecutions++;
    methodStats.executions++;
    if (metrics.success) {
      stats.successfulExecutions++;
    } else {
      stats.failedExecutions++;
      methodStats.failures++;
    }

    // Update timing metrics
    const executionTime = metrics.endTime - metrics.startTime;
    stats.totalExecutionTime += executionTime;
    stats.averageExecutionTime = stats.totalExecutionTime / stats.totalExecutions;
    stats.lastExecutionTime = metrics.endTime;
    methodStats.totalTime += executionTime;
    methodStats.averageTime = methodStats.totalTime / methodStats.executions;

    // Update error rate
    stats.errorRate = stats.failedExecutions / stats.totalExecutions;

    // Update resource usage metrics
    this.updateResourceMetrics(stats, metrics);

    // Emit events for real-time monitoring
    this.emit('execution', {
      pluginId: metrics.pluginId,
      success: metrics.success,
      executionTime,
      methodName: metrics.methodName,
    });

    if (!metrics.success) {
      this.emit('error', {
        pluginId: metrics.pluginId,
        error: metrics.error,
        methodName: metrics.methodName,
      });
    }
  }

  getPluginStats(pluginId: string): PluginStats | undefined {
    return this.metrics.get(pluginId);
  }

  getSystemSnapshot(): AnalyticsSnapshot {
    const totalPlugins = this.metrics.size;
    let totalExecutions = 0;
    let totalErrors = 0;
    let totalTime = 0;
    let activePlugins = 0;

    for (const stats of this.metrics.values()) {
      totalExecutions += stats.totalExecutions;
      totalErrors += stats.failedExecutions;
      totalTime += stats.totalExecutionTime;
      if (Date.now() - stats.lastExecutionTime < 3600000) { // Active in last hour
        activePlugins++;
      }
    }

    return {
      timestamp: Date.now(),
      plugins: Object.fromEntries(this.metrics),
      systemMetrics: {
        totalPlugins,
        activePlugins,
        totalExecutions,
        globalErrorRate: totalErrors / totalExecutions,
        averageResponseTime: totalTime / totalExecutions,
      },
    };
  }

  getHistoricalData(
    pluginId: string,
    startTime: number,
    endTime: number
  ): AnalyticsSnapshot[] {
    return this.snapshots.filter(
      snapshot =>
        snapshot.timestamp >= startTime &&
        snapshot.timestamp <= endTime &&
        snapshot.plugins[pluginId]
    );
  }

  generateReport(pluginId?: string): string {
    const report: string[] = ['Plugin Analytics Report'];
    report.push('='.repeat(30));

    if (pluginId) {
      const stats = this.metrics.get(pluginId);
      if (stats) {
        this.appendPluginReport(report, pluginId, stats);
      } else {
        report.push(`No data available for plugin: ${pluginId}`);
      }
    } else {
      for (const [id, stats] of this.metrics) {
        this.appendPluginReport(report, id, stats);
        report.push('-'.repeat(30));
      }
    }

    return report.join('\n');
  }

  private getOrCreateStats(pluginId: string): PluginStats {
    if (!this.metrics.has(pluginId)) {
      this.metrics.set(pluginId, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        lastExecutionTime: 0,
        errorRate: 0,
        methodStats: {},
        memoryUsage: {
          averageHeapUsed: 0,
          peakHeapUsed: 0,
        },
        cpuUsage: {
          averageUserTime: 0,
          averageSystemTime: 0,
        },
      });
    }
    return this.metrics.get(pluginId)!;
  }

  private getOrCreateMethodStats(
    stats: PluginStats,
    methodName: string
  ): PluginStats['methodStats'][string] {
    if (!stats.methodStats[methodName]) {
      stats.methodStats[methodName] = {
        executions: 0,
        failures: 0,
        totalTime: 0,
        averageTime: 0,
      };
    }
    return stats.methodStats[methodName];
  }

  private updateResourceMetrics(
    stats: PluginStats,
    metrics: ExecutionMetrics
  ): void {
    // Update memory metrics
    const currentHeapUsed = metrics.memoryUsage.heapUsed;
    stats.memoryUsage.averageHeapUsed = (
      (stats.memoryUsage.averageHeapUsed * (stats.totalExecutions - 1)) +
      currentHeapUsed
    ) / stats.totalExecutions;
    
    stats.memoryUsage.peakHeapUsed = Math.max(
      stats.memoryUsage.peakHeapUsed,
      currentHeapUsed
    );

    // Update CPU metrics
    stats.cpuUsage.averageUserTime = (
      (stats.cpuUsage.averageUserTime * (stats.totalExecutions - 1)) +
      metrics.cpuUsage.user
    ) / stats.totalExecutions;
    
    stats.cpuUsage.averageSystemTime = (
      (stats.cpuUsage.averageSystemTime * (stats.totalExecutions - 1)) +
      metrics.cpuUsage.system
    ) / stats.totalExecutions;
  }

  private startSnapshotCollection(): void {
    setInterval(() => {
      const snapshot = this.getSystemSnapshot();
      this.snapshots.push(snapshot);

      // Keep only the last 24 hours of snapshots
      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots.shift();
      }

      this.emit('snapshot', snapshot);
    }, this.snapshotInterval);
  }

  private appendPluginReport(
    report: string[],
    pluginId: string,
    stats: PluginStats
  ): void {
    report.push(`Plugin ID: ${pluginId}`);
    report.push(`Total Executions: ${stats.totalExecutions}`);
    report.push(`Success Rate: ${((1 - stats.errorRate) * 100).toFixed(2)}%`);
    report.push(`Average Execution Time: ${stats.averageExecutionTime.toFixed(2)}ms`);
    report.push('\nMethod Statistics:');
    
    for (const [method, methodStats] of Object.entries(stats.methodStats)) {
      report.push(`  ${method}:`);
      report.push(`    Executions: ${methodStats.executions}`);
      report.push(`    Average Time: ${methodStats.averageTime.toFixed(2)}ms`);
      report.push(`    Failure Rate: ${(methodStats.failures / methodStats.executions * 100).toFixed(2)}%`);
    }

    report.push('\nResource Usage:');
    report.push(`  Average Heap: ${(stats.memoryUsage.averageHeapUsed / 1024 / 1024).toFixed(2)}MB`);
    report.push(`  Peak Heap: ${(stats.memoryUsage.peakHeapUsed / 1024 / 1024).toFixed(2)}MB`);
    report.push(`  Average CPU (user): ${stats.cpuUsage.averageUserTime.toFixed(2)}ms`);
    report.push(`  Average CPU (system): ${stats.cpuUsage.averageSystemTime.toFixed(2)}ms`);
  }
} 