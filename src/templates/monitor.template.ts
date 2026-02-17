import { Config } from "../config";
import { Logger } from "../logger";

export interface HealthStatus {
  healthy: boolean;
  uptime: number;
  errorCount: number;
  lastHeartbeat: Date;
  metrics: Record<string, number>;
}

export class MonitorService {
  private config: Config;
  private logger: Logger;
  private startTime: Date;
  private errorCount: number = 0;
  private lastHeartbeat: Date;
  private metrics: Map<string, number>;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.startTime = new Date();
    this.lastHeartbeat = new Date();
    this.metrics = new Map();
  }

  async start(): Promise<void> {
    if (!this.config.monitoring.enabled) {
      this.logger.info("Monitoring is disabled");
      return;
    }

    this.logger.info("Starting monitoring service");

    // Start periodic health checks
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.monitoring.healthCheckInterval);
  }

  async stop(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.logger.info("Monitoring service stopped");
    }
  }

  async recordHeartbeat(): Promise<void> {
    this.lastHeartbeat = new Date();
  }

  async recordError(error: Error): Promise<void> {
    this.errorCount++;
    this.logger.error("Recorded error in monitoring", error);
  }

  async recordMetric(name: string, value: number): Promise<void> {
    this.metrics.set(name, value);
  }

  getHealthStatus(): HealthStatus {
    const uptime = Date.now() - this.startTime.getTime();

    return {
      healthy: this.errorCount < 10 && Date.now() - this.lastHeartbeat.getTime() < 60000,
      uptime,
      errorCount: this.errorCount,
      lastHeartbeat: this.lastHeartbeat,
      metrics: Object.fromEntries(this.metrics),
    };
  }

  private performHealthCheck(): void {
    const status = this.getHealthStatus();

    if (!status.healthy) {
      this.logger.warn("Health check failed", {
        errorCount: status.errorCount,
        lastHeartbeat: status.lastHeartbeat,
      });
    } else {
      this.logger.debug("Health check passed", {
        uptime: status.uptime,
        errorCount: status.errorCount,
      });
    }
  }
}
