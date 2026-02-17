import * as dotenv from "dotenv";
import { config } from "./config";
import { MemoryEngine } from "./engines/memory.engine";
import { Logger } from "./engines/logger";
import { StateManager } from "./engines/state.manager";
import { TelegramInterface } from "./interfaces/telegram.interface";
import { PlanningEngine } from "./engines/planning.engine";
import { SecurityEngine } from "./engines/security.engine";
import { ApprovalEngine } from "./engines/approval.engine";
import { AgentGenerator } from "./engines/agent.generator";
import { ValidationEngine } from "./engines/validation.engine";
import { DeploymentEngine } from "./engines/deployment.engine";
import { MonitorEngine } from "./engines/monitor.engine";
import { RecoveryEngine } from "./engines/recovery.engine";
import {
  AgentRequest,
  AgentState,
  InitialPlan,
  DetailedPlan,
  ApprovalStatus,
} from "./types";

dotenv.config();

export class SABAOrchestrator {
  // Core engines
  private memoryEngine: MemoryEngine;
  private logger: Logger;
  private stateManager: StateManager;
  private telegram: TelegramInterface;

  // Intelligence engines
  private planningEngine: PlanningEngine;
  private securityEngine: SecurityEngine;
  private approvalEngine: ApprovalEngine;

  // Execution engines
  private agentGenerator: AgentGenerator;
  private validationEngine: ValidationEngine;

  // Operations engines
  private deploymentEngine: DeploymentEngine;
  private monitorEngine: MonitorEngine;
  private recoveryEngine: RecoveryEngine;

  private isRunning: boolean = false;

  constructor() {
    // Initialize core engines
    this.memoryEngine = new MemoryEngine();
    this.logger = new Logger(this.memoryEngine);
    this.stateManager = new StateManager(this.memoryEngine, this.logger);

    // Initialize Telegram interface
    this.telegram = new TelegramInterface(
      {
        botToken: config.telegram.botToken,
        adminChatId: config.telegram.adminChatId,
      },
      this.logger,
      this.memoryEngine,
      this.stateManager
    );

    // Initialize intelligence engines
    this.planningEngine = new PlanningEngine(this.memoryEngine, this.logger);
    this.securityEngine = new SecurityEngine(this.memoryEngine, this.logger);
    this.approvalEngine = new ApprovalEngine(
      this.memoryEngine,
      this.logger,
      this.telegram
    );

    // Initialize execution engines
    this.agentGenerator = new AgentGenerator(this.logger, this.memoryEngine);
    this.validationEngine = new ValidationEngine(this.logger, this.securityEngine);

    // Initialize operations engines
    this.deploymentEngine = new DeploymentEngine(
      this.logger,
      this.memoryEngine,
      this.stateManager
    );
    this.monitorEngine = new MonitorEngine(
      this.logger,
      this.memoryEngine,
      this.deploymentEngine,
      this.telegram
    );
    this.recoveryEngine = new RecoveryEngine(
      this.logger,
      this.memoryEngine,
      this.stateManager,
      this.deploymentEngine,
      this.telegram
    );

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Initialize SABA
   */
  async initialize(): Promise<void> {
    await this.logger.info("Initializing SABA (ShelfEx Agent Builder Agent)...");

    try {
      // Check database connection
      const dbHealthy = await this.memoryEngine.healthCheck();
      if (!dbHealthy) {
        throw new Error("Database health check failed");
      }

      this.isRunning = true;
      await this.logger.info("SABA initialized successfully");

      console.log("\n✓ SABA is running");
      console.log("✓ Telegram bot is active");
      console.log("✓ Database connected");
      console.log("\nReady to create agents!");
    } catch (error) {
      await this.logger.error("Failed to initialize SABA", error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Setup event handlers for Telegram commands
   */
  private setupEventHandlers(): void {
    // Handle create_agent command
    this.telegram.on("create_agent", async (data: any) => {
      await this.handleCreateAgentCommand(data);
    });

    // Handle approval responses
    this.telegram.on("approval_response", async (data: any) => {
      // Approval is already handled by ApprovalEngine
      // This event is just for logging
      await this.logger.approval(
        `Approval ${data.approvalId} ${data.status} by ${data.approvedBy}`
      );
    });

    // Handle stop_agent command
    this.telegram.on("stop_agent", async (data: any) => {
      await this.handleStopAgent(data.agentName, data.chatId);
    });

    // Handle start_agent command
    this.telegram.on("start_agent", async (data: any) => {
      await this.handleStartAgent(data.agentName, data.chatId);
    });

    // Handle delete_agent command
    this.telegram.on("delete_agent", async (data: any) => {
      await this.handleDeleteAgent(data.agentName, data.chatId);
    });
  }

  /**
   * Main agent creation workflow
   */
  async createAgent(request: AgentRequest): Promise<string> {
    await this.logger.info(
      `Creating new agent: ${request.name}`,
      undefined,
      { request }
    );

    try {
      // Check if agent with same name already exists
      const existingAgent = await this.memoryEngine.getAgentByName(request.name);
      if (existingAgent) {
        const errorMsg = `Agent with name "${request.name}" already exists. Please use a different name or delete the existing agent first.`;
        await this.telegram.sendError(request.name, errorMsg);
        throw new Error(errorMsg);
      }

      // Stage 0: Request Intake
      const agent = await this.memoryEngine.createAgent(request);
      const agentId = agent.id;

      await this.telegram.sendStatusUpdate(
        request.name,
        "Agent creation started",
        `Agent ID: ${agentId}`
      );

      // Start the agent creation workflow in background
      this.runAgentCreationWorkflow(agentId, request).catch(async (error) => {
        await this.logger.error(
          "Agent creation workflow failed",
          error instanceof Error ? error : undefined,
          agentId
        );

        await this.recoveryEngine.recover(
          agentId,
          "generation_failure",
          error instanceof Error ? error : new Error(String(error))
        );
      });

      return agentId;
    } catch (error) {
      await this.logger.error(
        "Failed to create agent",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Run the full agent creation workflow
   */
  private async runAgentCreationWorkflow(
    agentId: string,
    request: AgentRequest
  ): Promise<void> {
    try {
      // Stage 1: Initial Planning
      await this.stateManager.transitionState(
        agentId,
        AgentState.PLANNING_INITIAL,
        "Starting initial planning"
      );

      const initialPlan = await this.planningEngine.createInitialPlan(
        agentId,
        request
      );

      await this.telegram.sendStatusUpdate(
        request.name,
        "Initial plan created",
        `Risk level: ${initialPlan.risk_level}`
      );

      // Update risk level
      await this.memoryEngine.updateAgentRiskLevel(agentId, initialPlan.risk_level);

      // Check if approval required for initial plan
      const initialApprovalRequired = this.approvalEngine.shouldRequestApproval(
        initialPlan.risk_level,
        "INITIAL_PLAN" as any
      );

      if (initialApprovalRequired) {
        await this.stateManager.transitionState(
          agentId,
          AgentState.WAITING_APPROVAL,
          "Waiting for initial plan approval"
        );

        const approved = await this.approvalEngine.requestInitialPlanApproval(
          agentId,
          request.name,
          initialPlan,
          initialPlan.risk_level
        );

        if (!approved) {
          await this.stateManager.transitionToFailed(
            agentId,
            "Initial plan rejected"
          );
          return;
        }
      }

      // Stage 2: Detailed Planning
      await this.stateManager.transitionState(
        agentId,
        AgentState.PLANNING_DETAILED,
        "Creating detailed plan"
      );

      const detailedPlan = await this.planningEngine.createDetailedPlan(
        agentId,
        request,
        initialPlan
      );

      await this.telegram.sendStatusUpdate(
        request.name,
        "Detailed plan created",
        `${detailedPlan.module_structure.length} modules, ${detailedPlan.tools_integration_plan.length} tools`
      );

      // Stage 3: Security Rules Definition
      await this.stateManager.transitionState(
        agentId,
        AgentState.SECURITY_DEFINED,
        "Defining security rules"
      );

      await this.securityEngine.defineSecurityRules(agentId, detailedPlan);

      // Classify risk level based on detailed plan
      const riskLevel = this.securityEngine.classifyRiskLevel(detailedPlan);
      await this.memoryEngine.updateAgentRiskLevel(agentId, riskLevel);

      // Stage 4: Approval Checkpoint
      await this.stateManager.transitionState(
        agentId,
        AgentState.WAITING_APPROVAL,
        "Waiting for detailed plan approval"
      );

      const detailedApproved = await this.approvalEngine.requestDetailedPlanApproval(
        agentId,
        request.name,
        detailedPlan,
        riskLevel
      );

      if (!detailedApproved) {
        await this.stateManager.transitionToFailed(
          agentId,
          "Detailed plan rejected"
        );
        return;
      }

      // Stage 5: Agent Generation
      await this.stateManager.transitionState(
        agentId,
        AgentState.GENERATING,
        "Generating agent code"
      );

      const generatedAgent = await this.agentGenerator.generateAgent(
        agentId,
        detailedPlan
      );

      await this.telegram.sendStatusUpdate(
        request.name,
        "Agent code generated",
        `${generatedAgent.files.length} files created`
      );

      // Stage 6: Validation
      await this.stateManager.transitionState(
        agentId,
        AgentState.VALIDATING,
        "Validating generated agent"
      );

      const validationResult = await this.validationEngine.validateAgent(
        agentId,
        generatedAgent
      );

      if (!validationResult.passed) {
        await this.telegram.sendAlert(
          request.name,
          "Validation Failed",
          `${validationResult.errors.length} errors found`
        );

        // Attempt recovery
        await this.recoveryEngine.recover(
          agentId,
          "validation_failure",
          new Error("Validation failed"),
          { validationResult }
        );
        return;
      }

      await this.telegram.sendStatusUpdate(
        request.name,
        "Validation passed",
        `All ${validationResult.stages_completed.length} stages completed`
      );

      // Stage 7: Deployment
      await this.stateManager.transitionState(
        agentId,
        AgentState.DEPLOYING,
        "Deploying agent"
      );

      const deploymentApproved = await this.approvalEngine.requestDeploymentApproval(
        agentId,
        request.name,
        detailedPlan.deployment_strategy.target,
        riskLevel
      );

      if (!deploymentApproved) {
        await this.stateManager.transitionToFailed(
          agentId,
          "Deployment rejected"
        );
        return;
      }

      const deploymentResult = await this.deploymentEngine.deployAgent(
        agentId,
        request.name,
        detailedPlan.deployment_strategy
      );

      if (!deploymentResult.success) {
        await this.telegram.sendError(
          request.name,
          `Deployment failed: ${deploymentResult.error_message}`
        );

        // Attempt recovery
        await this.recoveryEngine.recover(
          agentId,
          "deployment_failure",
          new Error(deploymentResult.error_message || "Deployment failed")
        );
        return;
      }

      // Stage 8: Monitoring
      await this.stateManager.transitionState(
        agentId,
        AgentState.ACTIVE,
        "Agent deployed and active"
      );

      await this.monitorEngine.startMonitoring(
        agentId,
        request.name,
        detailedPlan.monitoring_strategy
      );

      await this.telegram.sendSuccess(
        request.name,
        `Agent deployed successfully! 🎉\nDeployment target: ${detailedPlan.deployment_strategy.target}`
      );

      await this.logger.info(`Agent creation complete: ${request.name}`, agentId);
    } catch (error) {
      await this.logger.error(
        "Agent creation workflow error",
        error instanceof Error ? error : undefined,
        agentId
      );

      await this.stateManager.transitionToFailed(
        agentId,
        "Workflow error",
        error instanceof Error ? error : undefined
      );

      throw error;
    }
  }

  // Command handlers
  private async handleCreateAgentCommand(data: any): Promise<void> {
    const request: AgentRequest = {
      name: data.name,
      goal: data.goal,
    };

    try {
      await this.createAgent(request);
    } catch (error) {
      await this.telegram.sendError(
        data.name,
        "Failed to create agent",
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  private async handleStopAgent(agentName: string, chatId: string): Promise<void> {
    try {
      const agent = await this.memoryEngine.getAgentByName(agentName);

      if (!agent) {
        await this.telegram.sendError(agentName, "Agent not found");
        return;
      }

      const stopped = await this.deploymentEngine.stopAgent(agent.id);

      if (stopped) {
        await this.monitorEngine.stopMonitoring(agent.id);
        await this.stateManager.transitionState(
          agent.id,
          AgentState.PAUSED,
          "Stopped by admin"
        );
        await this.telegram.sendSuccess(agentName, "Agent stopped");
      } else {
        await this.telegram.sendError(agentName, "Failed to stop agent");
      }
    } catch (error) {
      await this.telegram.sendError(
        agentName,
        "Error stopping agent",
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  private async handleStartAgent(agentName: string, chatId: string): Promise<void> {
    try {
      const agent = await this.memoryEngine.getAgentByName(agentName);

      if (!agent) {
        await this.telegram.sendError(agentName, "Agent not found");
        return;
      }

      const started = await this.deploymentEngine.startAgent(agent.id);

      if (started) {
        await this.stateManager.transitionState(
          agent.id,
          AgentState.ACTIVE,
          "Started by admin"
        );

        // Restart monitoring
        const plan = await this.memoryEngine.getPlan(agent.id, "detailed");
        if (plan) {
          const detailedPlan = plan.plan_data as DetailedPlan;
          await this.monitorEngine.startMonitoring(
            agent.id,
            agent.name,
            detailedPlan.monitoring_strategy
          );
        }

        await this.telegram.sendSuccess(agentName, "Agent started");
      } else {
        await this.telegram.sendError(agentName, "Failed to start agent");
      }
    } catch (error) {
      await this.telegram.sendError(
        agentName,
        "Error starting agent",
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  private async handleDeleteAgent(agentName: string, chatId: string): Promise<void> {
    try {
      const agent = await this.memoryEngine.getAgentByName(agentName);

      if (!agent) {
        await this.telegram.sendError(agentName, "Agent not found");
        return;
      }

      // Stop and cleanup
      await this.deploymentEngine.stopAgent(agent.id);
      await this.monitorEngine.stopMonitoring(agent.id);

      await this.stateManager.transitionState(
        agent.id,
        AgentState.DELETED,
        "Deleted by admin"
      );

      await this.telegram.sendSuccess(agentName, "Agent deleted");
    } catch (error) {
      await this.telegram.sendError(
        agentName,
        "Error deleting agent",
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  /**
   * Shutdown SABA gracefully
   */
  async shutdown(): Promise<void> {
    await this.logger.info("Shutting down SABA...");
    this.isRunning = false;

    // Cleanup
    await this.monitorEngine.cleanup();
    await this.deploymentEngine.cleanup();

    await this.logger.info("SABA shutdown complete");
  }
}

// Entry point
if (require.main === module) {
  const orchestrator = new SABAOrchestrator();

  // Handle shutdown signals
  process.on("SIGINT", async () => {
    console.log("\nReceived SIGINT, shutting down...");
    await orchestrator.shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\nReceived SIGTERM, shutting down...");
    await orchestrator.shutdown();
    process.exit(0);
  });

  // Start SABA
  orchestrator.initialize().catch((error) => {
    console.error("Failed to start SABA:", error);
    process.exit(1);
  });
}
