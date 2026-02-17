import * as dotenv from "dotenv";
import { Logger } from "./logger";
import { SecurityEnforcer } from "./security/enforcer";
import { MemoryManager } from "./memory/manager";
import { MonitorService } from "./monitor/service";
import { Config, loadConfig } from "./config";
{{TOOL_IMPORTS}}

dotenv.config();

export class {{AGENT_NAME}}Agent {
  private config: Config;
  private logger: Logger;
  private security: SecurityEnforcer;
  private memory: MemoryManager;
  private monitor: MonitorService;
  private isRunning: boolean = false;
  {{TOOL_DECLARATIONS}}

  constructor() {
    this.config = loadConfig();
    this.logger = new Logger(this.config);
    this.security = new SecurityEnforcer(this.config, this.logger);
    this.memory = new MemoryManager(this.config, this.logger);
    this.monitor = new MonitorService(this.config, this.logger);
    {{TOOL_INITIALIZATIONS}}
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info("Initializing {{AGENT_NAME}} agent...");

      // Initialize components
      await this.memory.initialize();
      await this.monitor.start();

      // Verify security rules
      const securityCheck = await this.security.validateConfiguration();
      if (!securityCheck.valid) {
        throw new Error(\`Security validation failed: \${securityCheck.errors.join(", ")}\`);
      }

      this.isRunning = true;
      this.logger.info("{{AGENT_NAME}} agent initialized successfully");

      // Start main execution loop
      await this.execute();
    } catch (error) {
      this.logger.error("Failed to initialize agent", error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Main execution logic
   */
  private async execute(): Promise<void> {
    this.logger.info("Starting {{AGENT_NAME}} agent execution");

    while (this.isRunning) {
      try {
        // Check health
        await this.monitor.recordHeartbeat();

        {{AGENT_LOGIC}}

        // Sleep between iterations
        await this.sleep({{EXECUTION_INTERVAL_MS}});
      } catch (error) {
        this.logger.error("Error in execution loop", error instanceof Error ? error : undefined);
        await this.monitor.recordError(error instanceof Error ? error : new Error(String(error)));

        // Back off on errors
        await this.sleep(5000);
      }
    }
  }

  /**
   * Shutdown the agent gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down {{AGENT_NAME}} agent...");
    this.isRunning = false;

    // Cleanup
    await this.monitor.stop();
    await this.memory.close();

    this.logger.info("{{AGENT_NAME}} agent shutdown complete");
  }

  // Helper methods
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Entry point
if (require.main === module) {
  const agent = new {{AGENT_NAME}}Agent();

  // Handle shutdown signals
  process.on("SIGINT", async () => {
    console.log("Received SIGINT, shutting down...");
    await agent.shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Received SIGTERM, shutting down...");
    await agent.shutdown();
    process.exit(0);
  });

  // Start agent
  agent.initialize().catch((error) => {
    console.error("Failed to start agent:", error);
    process.exit(1);
  });
}
