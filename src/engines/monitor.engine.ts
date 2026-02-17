import { Logger } from "./logger";
import { MemoryEngine } from "./memory.engine";
import { DeploymentEngine } from "./deployment.engine";
import { TelegramInterface } from "../interfaces/telegram.interface";
import { HealthStatus, HealthMetrics, MonitoringStrategy } from "../types";
import { config } from "../config";

interface MonitoringSession {
  agentId: string;
  agentName: string;
  strategy: MonitoringStrategy;
  intervalId: NodeJS.Timeout;
  startedAt: Date;
  healthHistory: HealthStatus[];
}

export class MonitorEngine {
  private logger: Logger;
  private memoryEngine: MemoryEngine;
  private deploymentEngine: DeploymentEngine;
  private telegram: TelegramInterface;
  private sessions: Map<string, MonitoringSession>;

  constructor(
    logger: Logger,
    memoryEngine: MemoryEngine,
    deploymentEngine: DeploymentEngine,
    telegram: TelegramInterface
  ) {
    this.logger = logger;
    this.memoryEngine = memoryEngine;
    this.deploymentEngine = deploymentEngine;
    this.telegram = telegram;
    this.sessions = new Map();
  }

  /**
   * Start monitoring an agent
   */
  async startMonitoring(
    agentId: string,
    agentName: string,
    strategy: MonitoringStrategy
  ): Promise<void> {
    // Stop existing monitoring session if any
    await this.stopMonitoring(agentId);

    await this.logger.monitoring(`Starting monitoring for ${agentName}`, agentId);

    const intervalId = setInterval(async () => {
      await this.performHealthCheck(agentId, agentName, strategy);
    }, strategy.health_check_interval_ms);

    const session: MonitoringSession = {
      agentId,
      agentName,
      strategy,
      intervalId,
      startedAt: new Date(),
      healthHistory: [],
    };

    this.sessions.set(agentId, session);

    // Perform initial health check
    await this.performHealthCheck(agentId, agentName, strategy);
  }

  /**
   * Stop monitoring an agent
   */
  async stopMonitoring(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId);

    if (session) {
      clearInterval(session.intervalId);
      this.sessions.delete(agentId);

      await this.logger.monitoring(
        `Stopped monitoring for ${session.agentName}`,
        agentId
      );
    }
  }

  /**
   * Perform health check on an agent
   */
  private async performHealthCheck(
    agentId: string,
    agentName: string,
    strategy: MonitoringStrategy
  ): Promise<void> {
    try {
      const session = this.sessions.get(agentId);
      if (!session) {
        return;
      }

      const deployment = this.deploymentEngine.getDeploymentStatus(agentId);
      if (!deployment) {
        await this.handleUnhealthy(
          agentId,
          agentName,
          "No deployment found",
          strategy
        );
        return;
      }

      // Check if agent is running
      const isRunning = await this.deploymentEngine.isAgentRunning(agentId);

      // Get error count from logs
      const recentErrors = await this.memoryEngine.getRecentErrors(agentId, 10);
      const errorCount = recentErrors.length;

      // Calculate uptime
      const uptime = Date.now() - deployment.deployedAt.getTime();

      const healthMetrics: HealthMetrics = {
        error_count: errorCount,
      };

      // Determine health status
      let status: "healthy" | "unhealthy" | "degraded" | "unknown" = "unknown";
      const issues: string[] = [];

      if (!isRunning) {
        status = "unhealthy";
        issues.push("Agent is not running");
      } else if (errorCount > config.monitoring.alertErrorThreshold) {
        status = "degraded";
        issues.push(`High error count: ${errorCount}`);
      } else {
        status = "healthy";
      }

      const healthStatus: HealthStatus = {
        agent_id: agentId,
        agent_name: agentName,
        status,
        uptime_ms: uptime,
        last_check: new Date(),
        metrics: healthMetrics,
        issues,
      };

      // Store health status
      session.healthHistory.push(healthStatus);

      // Keep only last 100 health checks
      if (session.healthHistory.length > 100) {
        session.healthHistory.shift();
      }

      // Log health status
      await this.logger.monitoring(
        `Health check: ${status}`,
        agentId,
        { status, issues, metrics: healthMetrics }
      );

      // Check alert conditions
      await this.checkAlertConditions(agentId, agentName, healthStatus, strategy);

      // Handle unhealthy status
      if (status === "unhealthy") {
        await this.handleUnhealthy(
          agentId,
          agentName,
          issues.join(", "),
          strategy
        );
      }
    } catch (error) {
      await this.logger.error(
        "Health check failed",
        error instanceof Error ? error : undefined,
        agentId
      );
    }
  }

  /**
   * Check alert conditions and send notifications
   */
  private async checkAlertConditions(
    agentId: string,
    agentName: string,
    healthStatus: HealthStatus,
    strategy: MonitoringStrategy
  ): Promise<void> {
    for (const condition of strategy.alert_conditions) {
      const metricValue = healthStatus.metrics[condition.metric];

      if (metricValue === undefined) {
        continue;
      }

      let shouldAlert = false;

      switch (condition.comparison) {
        case ">":
          shouldAlert = metricValue > condition.threshold;
          break;
        case "<":
          shouldAlert = metricValue < condition.threshold;
          break;
        case ">=":
          shouldAlert = metricValue >= condition.threshold;
          break;
        case "<=":
          shouldAlert = metricValue <= condition.threshold;
          break;
        case "==":
          shouldAlert = metricValue === condition.threshold;
          break;
        case "!=":
          shouldAlert = metricValue !== condition.threshold;
          break;
      }

      if (shouldAlert) {
        await this.handleAlert(
          agentId,
          agentName,
          condition.metric,
          metricValue,
          condition.threshold,
          condition.action
        );
      }
    }
  }

  /**
   * Handle alert condition
   */
  private async handleAlert(
    agentId: string,
    agentName: string,
    metric: string,
    value: number,
    threshold: number,
    action: string
  ): Promise<void> {
    const message = `Alert: ${metric} is ${value} (threshold: ${threshold})`;

    await this.logger.monitoring(message, agentId, { metric, value, threshold });

    // Send Telegram alert
    await this.telegram.sendAlert(agentName, "Monitoring Alert", message);

    // Perform action
    switch (action) {
      case "restart":
        await this.logger.monitoring(
          `Attempting to restart agent due to alert`,
          agentId
        );
        await this.deploymentEngine.restartAgent(agentId);
        break;

      case "pause":
        await this.logger.monitoring(
          `Pausing agent due to alert`,
          agentId
        );
        await this.deploymentEngine.stopAgent(agentId);
        break;

      case "escalate":
        await this.telegram.sendAlert(
          agentName,
          "CRITICAL ALERT - Escalation Required",
          message
        );
        break;

      case "notify":
      default:
        // Already notified via Telegram
        break;
    }
  }

  /**
   * Handle unhealthy agent
   */
  private async handleUnhealthy(
    agentId: string,
    agentName: string,
    reason: string,
    strategy: MonitoringStrategy
  ): Promise<void> {
    await this.logger.monitoring(
      `Agent unhealthy: ${reason}`,
      agentId,
      { reason }
    );

    // Send alert
    await this.telegram.sendAlert(
      agentName,
      "Agent Unhealthy",
      `Reason: ${reason}`
    );

    // Check if we should attempt automatic recovery
    const session = this.sessions.get(agentId);
    if (!session) {
      return;
    }

    // Count recent unhealthy checks
    const recentUnhealthy = session.healthHistory
      .slice(-5)
      .filter((h) => h.status === "unhealthy").length;

    // If agent has been unhealthy for 3+ consecutive checks, attempt restart
    if (recentUnhealthy >= 3) {
      await this.logger.monitoring(
        `Attempting automatic restart after ${recentUnhealthy} unhealthy checks`,
        agentId
      );

      try {
        const restarted = await this.deploymentEngine.restartAgent(agentId);

        if (restarted) {
          await this.telegram.sendStatusUpdate(
            agentName,
            "Restarted",
            "Agent was automatically restarted due to health issues"
          );
        } else {
          await this.telegram.sendError(
            agentName,
            "Failed to restart agent automatically"
          );
        }
      } catch (error) {
        await this.logger.error(
          "Failed to restart unhealthy agent",
          error instanceof Error ? error : undefined,
          agentId
        );
      }
    }
  }

  /**
   * Get current health status of an agent
   */
  async getHealthStatus(agentId: string): Promise<HealthStatus | null> {
    const session = this.sessions.get(agentId);

    if (!session || session.healthHistory.length === 0) {
      return null;
    }

    return session.healthHistory[session.healthHistory.length - 1];
  }

  /**
   * Get health history for an agent
   */
  getHealthHistory(agentId: string, limit: number = 50): HealthStatus[] {
    const session = this.sessions.get(agentId);

    if (!session) {
      return [];
    }

    return session.healthHistory.slice(-limit);
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(agentId: string): {
    total_checks: number;
    healthy_checks: number;
    unhealthy_checks: number;
    degraded_checks: number;
    uptime_percentage: number;
  } | null {
    const session = this.sessions.get(agentId);

    if (!session || session.healthHistory.length === 0) {
      return null;
    }

    const history = session.healthHistory;
    const totalChecks = history.length;
    const healthyChecks = history.filter((h) => h.status === "healthy").length;
    const unhealthyChecks = history.filter((h) => h.status === "unhealthy").length;
    const degradedChecks = history.filter((h) => h.status === "degraded").length;
    const uptimePercentage = (healthyChecks / totalChecks) * 100;

    return {
      total_checks: totalChecks,
      healthy_checks: healthyChecks,
      unhealthy_checks: unhealthyChecks,
      degraded_checks: degradedChecks,
      uptime_percentage: parseFloat(uptimePercentage.toFixed(2)),
    };
  }

  /**
   * Check if an agent is being monitored
   */
  isMonitoring(agentId: string): boolean {
    return this.sessions.has(agentId);
  }

  /**
   * Get all active monitoring sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Cleanup all monitoring sessions
   */
  async cleanup(): Promise<void> {
    for (const [agentId] of this.sessions) {
      await this.stopMonitoring(agentId);
    }
  }
}
