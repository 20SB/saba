import { MemoryEngine } from "./memory.engine";
import { Logger } from "./logger";
import { AgentState } from "../types";

// Define valid state transitions
const VALID_TRANSITIONS: Record<AgentState, AgentState[]> = {
  [AgentState.REQUESTED]: [AgentState.PLANNING_INITIAL, AgentState.FAILED],
  [AgentState.PLANNING_INITIAL]: [
    AgentState.PLANNING_DETAILED,
    AgentState.WAITING_APPROVAL,
    AgentState.FAILED,
  ],
  [AgentState.PLANNING_DETAILED]: [
    AgentState.SECURITY_DEFINED,
    AgentState.FAILED,
  ],
  [AgentState.SECURITY_DEFINED]: [AgentState.WAITING_APPROVAL, AgentState.FAILED],
  [AgentState.WAITING_APPROVAL]: [
    AgentState.GENERATING,
    AgentState.PLANNING_DETAILED, // if rejected, go back to planning
    AgentState.FAILED,
  ],
  [AgentState.GENERATING]: [AgentState.VALIDATING, AgentState.FAILED],
  [AgentState.VALIDATING]: [
    AgentState.DEPLOYING,
    AgentState.GENERATING, // if validation fails, regenerate
    AgentState.FAILED,
  ],
  [AgentState.DEPLOYING]: [AgentState.ACTIVE, AgentState.FAILED],
  [AgentState.ACTIVE]: [AgentState.PAUSED, AgentState.DELETED, AgentState.FAILED],
  [AgentState.PAUSED]: [AgentState.ACTIVE, AgentState.DELETED],
  [AgentState.FAILED]: [
    AgentState.REQUESTED, // retry from beginning
    AgentState.GENERATING, // retry generation
    AgentState.DELETED,
  ],
  [AgentState.DELETED]: [], // terminal state
};

export class StateManager {
  private memoryEngine: MemoryEngine;
  private logger: Logger;

  constructor(memoryEngine: MemoryEngine, logger: Logger) {
    this.memoryEngine = memoryEngine;
    this.logger = logger;
  }

  /**
   * Check if a state transition is valid
   */
  isValidTransition(fromState: AgentState, toState: AgentState): boolean {
    const allowedStates = VALID_TRANSITIONS[fromState];
    return allowedStates.includes(toState);
  }

  /**
   * Get all valid next states for a given state
   */
  getValidNextStates(currentState: AgentState): AgentState[] {
    return VALID_TRANSITIONS[currentState] || [];
  }

  /**
   * Get current state of an agent
   */
  async getCurrentState(agentId: string): Promise<AgentState | null> {
    const agent = await this.memoryEngine.getAgent(agentId);
    return agent ? agent.status : null;
  }

  /**
   * Transition an agent to a new state
   */
  async transitionState(
    agentId: string,
    toState: AgentState,
    reason?: string
  ): Promise<boolean> {
    try {
      // Get current state
      const agent = await this.memoryEngine.getAgent(agentId);
      if (!agent) {
        await this.logger.error(
          `Cannot transition state: Agent ${agentId} not found`
        );
        return false;
      }

      const fromState = agent.status;

      // Check if transition is valid
      if (!this.isValidTransition(fromState, toState)) {
        await this.logger.warning(
          `Invalid state transition attempted: ${fromState} → ${toState}`,
          agentId,
          { reason }
        );
        return false;
      }

      // Perform transition
      await this.memoryEngine.updateAgentState(agentId, toState);

      // Log transition
      await this.logger.stateTransition(
        reason || "State transition",
        agentId,
        fromState,
        toState
      );

      return true;
    } catch (error) {
      await this.logger.error(
        `Error during state transition: ${error}`,
        error instanceof Error ? error : undefined,
        agentId
      );
      return false;
    }
  }

  /**
   * Transition to FAILED state (always allowed from any state)
   */
  async transitionToFailed(
    agentId: string,
    reason: string,
    error?: Error
  ): Promise<void> {
    const agent = await this.memoryEngine.getAgent(agentId);
    if (!agent) {
      await this.logger.error(`Cannot fail agent: Agent ${agentId} not found`);
      return;
    }

    await this.memoryEngine.updateAgentState(agentId, AgentState.FAILED);

    await this.logger.error(
      `Agent transitioned to FAILED state: ${reason}`,
      error,
      agentId
    );
  }

  /**
   * Validate if an agent can be transitioned to a specific state
   */
  async canTransition(agentId: string, toState: AgentState): Promise<boolean> {
    const currentState = await this.getCurrentState(agentId);
    if (!currentState) {
      return false;
    }
    return this.isValidTransition(currentState, toState);
  }

  /**
   * Get state transition history for an agent
   */
  async getStateHistory(agentId: string): Promise<any[]> {
    const logs = await this.memoryEngine.getLogs(
      agentId,
      undefined,
      undefined,
      1000
    );

    // Filter for state transition logs
    return logs
      .filter((log) => log.metadata && "fromState" in log.metadata)
      .map((log) => ({
        timestamp: log.created_at,
        fromState: log.metadata!.fromState,
        toState: log.metadata!.toState,
        message: log.message,
      }));
  }

  /**
   * Check if agent is in a terminal state
   */
  isTerminalState(state: AgentState): boolean {
    return VALID_TRANSITIONS[state].length === 0;
  }

  /**
   * Check if agent is in an active operational state
   */
  isOperationalState(state: AgentState): boolean {
    return state === AgentState.ACTIVE;
  }

  /**
   * Check if agent is waiting for approval
   */
  isWaitingForApproval(state: AgentState): boolean {
    return state === AgentState.WAITING_APPROVAL;
  }

  /**
   * Check if agent is in a failed state
   */
  isFailed(state: AgentState): boolean {
    return state === AgentState.FAILED;
  }

  /**
   * Get human-readable state description
   */
  getStateDescription(state: AgentState): string {
    const descriptions: Record<AgentState, string> = {
      [AgentState.REQUESTED]: "Agent creation requested, awaiting initial planning",
      [AgentState.PLANNING_INITIAL]:
        "Generating initial high-level plan for the agent",
      [AgentState.PLANNING_DETAILED]:
        "Creating detailed architectural and implementation plan",
      [AgentState.SECURITY_DEFINED]:
        "Defining security rules and access controls",
      [AgentState.WAITING_APPROVAL]:
        "Waiting for human approval to proceed",
      [AgentState.GENERATING]: "Generating agent code and structure",
      [AgentState.VALIDATING]:
        "Validating generated code for correctness and security",
      [AgentState.DEPLOYING]: "Deploying agent to target environment",
      [AgentState.ACTIVE]: "Agent is deployed and operational",
      [AgentState.PAUSED]: "Agent is paused and not executing",
      [AgentState.FAILED]: "Agent creation or operation failed",
      [AgentState.DELETED]: "Agent has been deleted",
    };

    return descriptions[state] || "Unknown state";
  }

  /**
   * Get state progress percentage (0-100)
   */
  getStateProgress(state: AgentState): number {
    const progressMap: Record<AgentState, number> = {
      [AgentState.REQUESTED]: 5,
      [AgentState.PLANNING_INITIAL]: 15,
      [AgentState.PLANNING_DETAILED]: 25,
      [AgentState.SECURITY_DEFINED]: 35,
      [AgentState.WAITING_APPROVAL]: 40,
      [AgentState.GENERATING]: 60,
      [AgentState.VALIDATING]: 75,
      [AgentState.DEPLOYING]: 90,
      [AgentState.ACTIVE]: 100,
      [AgentState.PAUSED]: 100,
      [AgentState.FAILED]: 0,
      [AgentState.DELETED]: 0,
    };

    return progressMap[state] || 0;
  }
}
