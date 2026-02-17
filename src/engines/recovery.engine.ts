import { Logger } from "./logger";
import { MemoryEngine } from "./memory.engine";
import { StateManager } from "./state.manager";
import { DeploymentEngine } from "./deployment.engine";
import { TelegramInterface } from "../interfaces/telegram.interface";
import { RecoveryAction, AgentState, LogLevel, LogType } from "../types";
import { config } from "../config";

export class RecoveryEngine {
  private logger: Logger;
  private memoryEngine: MemoryEngine;
  private stateManager: StateManager;
  private deploymentEngine: DeploymentEngine;
  private telegram: TelegramInterface;
  private recoveryAttempts: Map<string, number>;

  constructor(
    logger: Logger,
    memoryEngine: MemoryEngine,
    stateManager: StateManager,
    deploymentEngine: DeploymentEngine,
    telegram: TelegramInterface
  ) {
    this.logger = logger;
    this.memoryEngine = memoryEngine;
    this.stateManager = stateManager;
    this.deploymentEngine = deploymentEngine;
    this.telegram = telegram;
    this.recoveryAttempts = new Map();
  }

  /**
   * Main recovery orchestrator
   */
  async recover(
    agentId: string,
    failureType: string,
    error: Error,
    context?: Record<string, any>
  ): Promise<boolean> {
    const agent = await this.memoryEngine.getAgent(agentId);
    if (!agent) {
      await this.logger.error("Cannot recover: Agent not found", undefined, agentId);
      return false;
    }

    await this.logger.error(
      `Recovery initiated for ${failureType}`,
      error,
      agentId,
      context
    );

    // Get recovery attempt count
    const attemptKey = `${agentId}:${failureType}`;
    const attempts = this.recoveryAttempts.get(attemptKey) || 0;

    // Check if max retries exceeded
    if (attempts >= config.security.maxRetryAttempts) {
      await this.logger.error(
        `Max recovery attempts (${config.security.maxRetryAttempts}) exceeded for ${failureType}`,
        undefined,
        agentId
      );

      await this.telegram.sendError(
        agent.name,
        `Recovery failed after ${attempts} attempts: ${failureType}`,
        error.stack
      );

      // Mark as failed
      await this.stateManager.transitionToFailed(
        agentId,
        `Recovery failed: ${failureType}`,
        error
      );

      return false;
    }

    // Increment attempt counter
    this.recoveryAttempts.set(attemptKey, attempts + 1);

    // Choose recovery strategy based on failure type
    let success = false;

    try {
      switch (failureType) {
        case "generation_failure":
          success = await this.recoverGenerationFailure(agentId, agent.name, error);
          break;

        case "validation_failure":
          success = await this.recoverValidationFailure(agentId, agent.name, error, context);
          break;

        case "deployment_failure":
          success = await this.recoverDeploymentFailure(agentId, agent.name, error);
          break;

        case "runtime_crash":
          success = await this.recoverRuntimeCrash(agentId, agent.name, error);
          break;

        default:
          success = await this.recoverGenericFailure(agentId, agent.name, failureType, error);
          break;
      }

      // Log recovery action
      const action: RecoveryAction = {
        agent_id: agentId,
        failure_type: failureType,
        recovery_strategy: this.getRecoveryStrategy(failureType),
        attempted_at: new Date(),
        success,
        details: success ? "Recovery successful" : `Recovery failed: ${error.message}`,
      };

      await this.memoryEngine.log(
        LogType.INFO,
        success ? LogLevel.INFO : LogLevel.ERROR,
        `Recovery ${success ? "succeeded" : "failed"} for ${failureType}`,
        agentId,
        action
      );

      if (success) {
        // Reset attempt counter on success
        this.recoveryAttempts.delete(attemptKey);

        await this.telegram.sendSuccess(
          agent.name,
          `Recovery successful for ${failureType}`
        );
      } else {
        await this.telegram.sendAlert(
          agent.name,
          "Recovery Attempt Failed",
          `Failed to recover from ${failureType}. Attempt ${attempts + 1}/${config.security.maxRetryAttempts}`
        );
      }

      return success;
    } catch (recoveryError) {
      await this.logger.error(
        "Recovery process error",
        recoveryError instanceof Error ? recoveryError : undefined,
        agentId
      );

      return false;
    }
  }

  /**
   * Recover from generation failure
   */
  private async recoverGenerationFailure(
    agentId: string,
    agentName: string,
    error: Error
  ): Promise<boolean> {
    await this.logger.info(
      "Attempting to recover from generation failure",
      agentId
    );

    // Transition back to GENERATING state for retry
    const transitioned = await this.stateManager.transitionState(
      agentId,
      AgentState.GENERATING,
      "Retrying generation after failure"
    );

    return transitioned;
  }

  /**
   * Recover from validation failure
   */
  private async recoverValidationFailure(
    agentId: string,
    agentName: string,
    error: Error,
    context?: Record<string, any>
  ): Promise<boolean> {
    await this.logger.info(
      "Attempting to recover from validation failure",
      agentId
    );

    // If validation errors are provided, attempt code repair
    if (context?.validationResult?.errors) {
      const errors = context.validationResult.errors;

      // For now, transition back to GENERATING to regenerate
      // In future, could use LLM to repair specific errors
      const transitioned = await this.stateManager.transitionState(
        agentId,
        AgentState.GENERATING,
        `Regenerating after validation failures: ${errors.length} errors`
      );

      return transitioned;
    }

    return false;
  }

  /**
   * Recover from deployment failure
   */
  private async recoverDeploymentFailure(
    agentId: string,
    agentName: string,
    error: Error
  ): Promise<boolean> {
    await this.logger.info(
      "Attempting to recover from deployment failure",
      agentId
    );

    // Stop any running deployment
    try {
      await this.deploymentEngine.stopAgent(agentId);
    } catch (stopError) {
      // Ignore stop errors
    }

    // Wait a bit before retry
    await this.sleep(5000);

    // Transition back to DEPLOYING state for retry
    const transitioned = await this.stateManager.transitionState(
      agentId,
      AgentState.DEPLOYING,
      "Retrying deployment after failure"
    );

    return transitioned;
  }

  /**
   * Recover from runtime crash
   */
  private async recoverRuntimeCrash(
    agentId: string,
    agentName: string,
    error: Error
  ): Promise<boolean> {
    await this.logger.info(
      "Attempting to recover from runtime crash",
      agentId
    );

    // Attempt to restart the agent
    try {
      const restarted = await this.deploymentEngine.restartAgent(agentId);

      if (restarted) {
        await this.logger.info("Agent restarted successfully", agentId);
        return true;
      } else {
        await this.logger.error("Failed to restart agent", undefined, agentId);
        return false;
      }
    } catch (restartError) {
      await this.logger.error(
        "Error during restart",
        restartError instanceof Error ? restartError : undefined,
        agentId
      );
      return false;
    }
  }

  /**
   * Recover from generic failure
   */
  private async recoverGenericFailure(
    agentId: string,
    agentName: string,
    failureType: string,
    error: Error
  ): Promise<boolean> {
    await this.logger.info(
      `Attempting generic recovery for ${failureType}`,
      agentId
    );

    // Get current state
    const currentState = await this.stateManager.getCurrentState(agentId);

    if (!currentState) {
      return false;
    }

    // Default recovery: transition to FAILED state and notify admin
    await this.stateManager.transitionToFailed(
      agentId,
      `Unrecoverable failure: ${failureType}`,
      error
    );

    return false;
  }

  /**
   * Retry generation with modified prompt
   */
  async retryGeneration(
    agentId: string,
    modificationHints: string[]
  ): Promise<boolean> {
    await this.logger.info(
      `Retrying generation with hints: ${modificationHints.join(", ")}`,
      agentId
    );

    // Get existing plans
    const detailedPlan = await this.memoryEngine.getPlan(agentId, "detailed");

    if (!detailedPlan) {
      await this.logger.error("No detailed plan found for retry", undefined, agentId);
      return false;
    }

    // Add modification hints to plan metadata
    const updatedPlanData = {
      ...detailedPlan.plan_data,
      retry_hints: modificationHints,
    };

    await this.memoryEngine.updatePlan(
      detailedPlan.id,
      updatedPlanData,
      true
    );

    // Transition to GENERATING for retry
    return await this.stateManager.transitionState(
      agentId,
      AgentState.GENERATING,
      "Retrying generation with modifications"
    );
  }

  /**
   * Rollback deployment
   */
  async rollbackDeployment(agentId: string): Promise<boolean> {
    await this.logger.info("Rolling back deployment", agentId);

    try {
      // Stop the agent
      await this.deploymentEngine.stopAgent(agentId);

      // Transition to VALIDATED state (before deployment)
      const transitioned = await this.stateManager.transitionState(
        agentId,
        AgentState.VALIDATING,
        "Rolled back from failed deployment"
      );

      return transitioned;
    } catch (error) {
      await this.logger.error(
        "Rollback failed",
        error instanceof Error ? error : undefined,
        agentId
      );
      return false;
    }
  }

  /**
   * Restart agent with recovery
   */
  async restartAgent(agentId: string, reason: string): Promise<boolean> {
    const agent = await this.memoryEngine.getAgent(agentId);
    if (!agent) {
      return false;
    }

    await this.logger.info(`Restarting agent: ${reason}`, agentId);

    return await this.deploymentEngine.restartAgent(agentId);
  }

  /**
   * Disable agent (stop and mark as paused)
   */
  async disableAgent(agentId: string, reason: string): Promise<boolean> {
    const agent = await this.memoryEngine.getAgent(agentId);
    if (!agent) {
      return false;
    }

    await this.logger.info(`Disabling agent: ${reason}`, agentId);

    await this.deploymentEngine.stopAgent(agentId);

    return await this.stateManager.transitionState(
      agentId,
      AgentState.PAUSED,
      reason
    );
  }

  /**
   * Get recovery strategy name for a failure type
   */
  private getRecoveryStrategy(failureType: string): string {
    const strategies: Record<string, string> = {
      generation_failure: "retry_generation",
      validation_failure: "repair_and_regenerate",
      deployment_failure: "rollback_and_retry",
      runtime_crash: "automatic_restart",
    };

    return strategies[failureType] || "manual_intervention";
  }

  /**
   * Get recovery attempt count
   */
  getRecoveryAttempts(agentId: string, failureType: string): number {
    const attemptKey = `${agentId}:${failureType}`;
    return this.recoveryAttempts.get(attemptKey) || 0;
  }

  /**
   * Reset recovery attempts
   */
  resetRecoveryAttempts(agentId: string, failureType?: string): void {
    if (failureType) {
      const attemptKey = `${agentId}:${failureType}`;
      this.recoveryAttempts.delete(attemptKey);
    } else {
      // Reset all attempts for this agent
      for (const [key] of this.recoveryAttempts) {
        if (key.startsWith(`${agentId}:`)) {
          this.recoveryAttempts.delete(key);
        }
      }
    }
  }

  // Helper methods
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
