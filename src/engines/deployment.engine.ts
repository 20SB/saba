import * as path from "path";
import { spawn, ChildProcess, execSync } from "child_process";
import Dockerode from "dockerode";
import { Logger } from "./logger";
import { MemoryEngine } from "./memory.engine";
import { StateManager } from "./state.manager";
import {
  DeploymentResult,
  DeploymentTarget,
  DeploymentStrategy,
} from "../types";
import { config } from "../config";

interface DeploymentMetadata {
  agentId: string;
  agentName: string;
  target: DeploymentTarget;
  processId?: number;
  containerId?: string;
  deployedAt: Date;
  status: "running" | "stopped" | "failed";
}

export class DeploymentEngine {
  private logger: Logger;
  private memoryEngine: MemoryEngine;
  private stateManager: StateManager;
  private docker: Dockerode;
  private deployments: Map<string, DeploymentMetadata>;
  private processes: Map<string, ChildProcess>;

  constructor(
    logger: Logger,
    memoryEngine: MemoryEngine,
    stateManager: StateManager
  ) {
    this.logger = logger;
    this.memoryEngine = memoryEngine;
    this.stateManager = stateManager;
    this.docker = new Dockerode();
    this.deployments = new Map();
    this.processes = new Map();
  }

  /**
   * Deploy an agent to the specified target
   */
  async deployAgent(
    agentId: string,
    agentName: string,
    strategy: DeploymentStrategy
  ): Promise<DeploymentResult> {
    await this.logger.deployment(
      `Starting deployment: ${agentName} to ${strategy.target}`,
      agentId
    );

    try {
      let result: DeploymentResult;

      switch (strategy.target) {
        case DeploymentTarget.LOCAL:
          result = await this.deployLocal(agentId, agentName, strategy);
          break;

        case DeploymentTarget.DOCKER:
          result = await this.deployDocker(agentId, agentName, strategy);
          break;

        default:
          throw new Error(`Unsupported deployment target: ${strategy.target}`);
      }

      if (result.success) {
        // Store deployment metadata
        this.deployments.set(agentId, {
          agentId,
          agentName,
          target: strategy.target,
          processId: result.process_id,
          containerId: result.container_id,
          deployedAt: new Date(),
          status: "running",
        });

        await this.logger.deployment(
          `Deployment successful: ${agentName}`,
          agentId,
          result
        );
      } else {
        await this.logger.error(
          `Deployment failed: ${result.error_message}`,
          undefined,
          agentId
        );
      }

      return result;
    } catch (error) {
      await this.logger.error(
        "Deployment error",
        error instanceof Error ? error : undefined,
        agentId
      );

      return {
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Deploy agent locally as a Node.js process
   */
  private async deployLocal(
    agentId: string,
    agentName: string,
    strategy: DeploymentStrategy
  ): Promise<DeploymentResult> {
    const agentPath = path.join(config.paths.agentsBasePath, agentName);

    try {
      // Install dependencies
      this.logger.info(`Installing dependencies for ${agentName}...`);
      execSync("npm install", {
        cwd: agentPath,
        stdio: "pipe",
        timeout: 120000,
      });

      // Build the agent
      this.logger.info(`Building ${agentName}...`);
      execSync("npm run build", {
        cwd: agentPath,
        stdio: "pipe",
        timeout: 60000,
      });

      // Start the agent as a background process
      this.logger.info(`Starting ${agentName}...`);

      const logPath = path.join(config.paths.logsPath, `${agentName}.log`);
      const errorLogPath = path.join(config.paths.logsPath, `${agentName}.error.log`);

      const childProcess = spawn("node", ["dist/brain.js"], {
        cwd: agentPath,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          ...strategy.environment_variables,
        },
      });

      // Pipe stdout and stderr to log files
      const fs = require("fs");
      const logStream = fs.createWriteStream(logPath, { flags: "a" });
      const errorLogStream = fs.createWriteStream(errorLogPath, { flags: "a" });

      childProcess.stdout.pipe(logStream);
      childProcess.stderr.pipe(errorLogStream);

      // Store process reference
      this.processes.set(agentId, childProcess);

      // Detach process so it continues running
      childProcess.unref();

      // Wait a bit to ensure process started
      await this.sleep(2000);

      // Check if process is still running
      if (childProcess.killed) {
        throw new Error("Process failed to start");
      }

      return {
        success: true,
        deployment_id: agentId,
        process_id: childProcess.pid,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Deploy agent as a Docker container
   */
  private async deployDocker(
    agentId: string,
    agentName: string,
    strategy: DeploymentStrategy
  ): Promise<DeploymentResult> {
    const agentPath = path.join(config.paths.agentsBasePath, agentName);
    const imageName = `${agentName}:latest`;

    try {
      // Build Docker image
      this.logger.info(`Building Docker image for ${agentName}...`);

      await new Promise<void>((resolve, reject) => {
        this.docker.buildImage(
          {
            context: agentPath,
            src: ["Dockerfile", "src", "package.json", "tsconfig.json"],
          },
          { t: imageName },
          (err, stream) => {
            if (err) {
              reject(err);
              return;
            }

            if (!stream) {
              reject(new Error("No stream returned from buildImage"));
              return;
            }

            this.docker.modem.followProgress(
              stream,
              (err, res) => (err ? reject(err) : resolve()),
              (event) => {
                if (event.stream) {
                  this.logger.info(`[Docker] ${event.stream.trim()}`);
                }
              }
            );
          }
        );
      });

      // Create and start container
      this.logger.info(`Creating Docker container for ${agentName}...`);

      const container = await this.docker.createContainer({
        Image: imageName,
        name: agentName,
        Env: Object.entries(strategy.environment_variables).map(
          ([key, value]) => `${key}=${value}`
        ),
        HostConfig: {
          RestartPolicy: {
            Name: "unless-stopped",
          },
          ...(strategy.resource_limits && {
            Memory: this.parseMemoryLimit(strategy.resource_limits.memory_limit),
            NanoCpus: this.parseCpuLimit(strategy.resource_limits.cpu_limit),
          }),
        },
      });

      await container.start();

      const containerInfo = await container.inspect();

      return {
        success: true,
        deployment_id: agentId,
        container_id: containerInfo.Id,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Stop a running agent
   */
  async stopAgent(agentId: string): Promise<boolean> {
    const deployment = this.deployments.get(agentId);

    if (!deployment) {
      await this.logger.warning(`No deployment found for agent: ${agentId}`);
      return false;
    }

    try {
      if (deployment.target === DeploymentTarget.LOCAL) {
        // Stop local process
        const process = this.processes.get(agentId);
        if (process && !process.killed) {
          process.kill("SIGTERM");
          this.processes.delete(agentId);
        }
      } else if (deployment.target === DeploymentTarget.DOCKER) {
        // Stop Docker container
        if (deployment.containerId) {
          const container = this.docker.getContainer(deployment.containerId);
          await container.stop();
        }
      }

      deployment.status = "stopped";
      await this.logger.deployment(`Agent stopped: ${deployment.agentName}`, agentId);

      return true;
    } catch (error) {
      await this.logger.error(
        "Failed to stop agent",
        error instanceof Error ? error : undefined,
        agentId
      );
      return false;
    }
  }

  /**
   * Start a stopped agent
   */
  async startAgent(agentId: string): Promise<boolean> {
    const deployment = this.deployments.get(agentId);

    if (!deployment) {
      await this.logger.warning(`No deployment found for agent: ${agentId}`);
      return false;
    }

    try {
      if (deployment.target === DeploymentTarget.DOCKER) {
        // Start Docker container
        if (deployment.containerId) {
          const container = this.docker.getContainer(deployment.containerId);
          await container.start();
        }
      } else {
        // For local deployment, need to redeploy
        const agent = await this.memoryEngine.getAgent(agentId);
        if (!agent) {
          throw new Error("Agent not found");
        }

        // Get deployment strategy from plan
        const plan = await this.memoryEngine.getPlan(agentId, "detailed");
        if (!plan) {
          throw new Error("Deployment plan not found");
        }

        const strategy = plan.plan_data.deployment_strategy as DeploymentStrategy;
        await this.deployLocal(agentId, agent.name, strategy);
      }

      deployment.status = "running";
      await this.logger.deployment(`Agent started: ${deployment.agentName}`, agentId);

      return true;
    } catch (error) {
      await this.logger.error(
        "Failed to start agent",
        error instanceof Error ? error : undefined,
        agentId
      );
      return false;
    }
  }

  /**
   * Restart an agent
   */
  async restartAgent(agentId: string): Promise<boolean> {
    await this.stopAgent(agentId);
    await this.sleep(2000);
    return await this.startAgent(agentId);
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus(agentId: string): DeploymentMetadata | undefined {
    return this.deployments.get(agentId);
  }

  /**
   * Check if agent is running
   */
  async isAgentRunning(agentId: string): Promise<boolean> {
    const deployment = this.deployments.get(agentId);

    if (!deployment) {
      return false;
    }

    try {
      if (deployment.target === DeploymentTarget.LOCAL) {
        const process = this.processes.get(agentId);
        return process !== undefined && !process.killed;
      } else if (deployment.target === DeploymentTarget.DOCKER) {
        if (!deployment.containerId) {
          return false;
        }

        const container = this.docker.getContainer(deployment.containerId);
        const info = await container.inspect();
        return info.State.Running;
      }

      return false;
    } catch (error) {
      await this.logger.error(
        "Failed to check agent status",
        error instanceof Error ? error : undefined,
        agentId
      );
      return false;
    }
  }

  // Helper methods
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseMemoryLimit(limit?: string): number | undefined {
    if (!limit) return undefined;

    // Parse memory limit like "512m" or "1g"
    const match = limit.match(/^(\d+)([mg])$/i);
    if (!match) return undefined;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    return unit === "m" ? value * 1024 * 1024 : value * 1024 * 1024 * 1024;
  }

  private parseCpuLimit(limit?: string): number | undefined {
    if (!limit) return undefined;

    // Parse CPU limit like "0.5" or "1"
    const value = parseFloat(limit);
    return isNaN(value) ? undefined : value * 1e9; // Convert to nanocpus
  }

  /**
   * Cleanup all deployments
   */
  async cleanup(): Promise<void> {
    for (const [agentId] of this.deployments) {
      await this.stopAgent(agentId);
    }
  }
}
