import { MemoryEngine } from "./memory.engine";
import { Logger } from "./logger";
import { TelegramInterface } from "../interfaces/telegram.interface";
import {
  ApprovalType,
  ApprovalStatus,
  Approval,
  RiskLevel,
  DetailedPlan,
  InitialPlan,
} from "../types";
import { config } from "../config";

export class ApprovalEngine {
  private memoryEngine: MemoryEngine;
  private logger: Logger;
  private telegram: TelegramInterface;

  constructor(
    memoryEngine: MemoryEngine,
    logger: Logger,
    telegram: TelegramInterface
  ) {
    this.memoryEngine = memoryEngine;
    this.logger = logger;
    this.telegram = telegram;
  }

  /**
   * Check if approval is required based on risk level and approval type
   */
  shouldRequestApproval(
    riskLevel: RiskLevel,
    approvalType: ApprovalType
  ): boolean {
    // Always require approval for CRITICAL risk level
    if (riskLevel === RiskLevel.CRITICAL) {
      return true;
    }

    // Require approval for SENSITIVE operations
    if (riskLevel === RiskLevel.SENSITIVE) {
      return true;
    }

    // Require approval for MODERATE risk on deployment and security
    if (riskLevel === RiskLevel.MODERATE) {
      if (
        approvalType === ApprovalType.DEPLOYMENT ||
        approvalType === ApprovalType.SECURITY_RULES
      ) {
        return true;
      }
    }

    // Always require approval for modifications and deletions
    if (
      approvalType === ApprovalType.MODIFICATION ||
      approvalType === ApprovalType.DELETION
    ) {
      return true;
    }

    // SAFE agents with initial planning don't need approval
    if (riskLevel === RiskLevel.SAFE && approvalType === ApprovalType.INITIAL_PLAN) {
      return false;
    }

    // Default to requiring approval for detailed plans
    if (approvalType === ApprovalType.DETAILED_PLAN) {
      return true;
    }

    return false;
  }

  /**
   * Request approval for an action
   */
  async requestApproval(
    agentId: string,
    agentName: string,
    approvalType: ApprovalType,
    details: string,
    requestData?: Record<string, any>
  ): Promise<string> {
    await this.logger.approval(
      `Requesting ${approvalType} approval for ${agentName}`,
      agentId
    );

    // Create approval record in database
    const approval = await this.memoryEngine.createApproval(
      agentId,
      approvalType,
      requestData
    );

    // Send Telegram notification
    const messageId = await this.telegram.sendApprovalRequest(
      agentName,
      approvalType,
      approval.id,
      details
    );

    // Update approval with Telegram message ID
    if (messageId) {
      await this.memoryEngine.updateApprovalStatus(
        approval.id,
        ApprovalStatus.PENDING,
        undefined,
        { telegram_message_id: messageId }
      );
    }

    await this.logger.approval(
      `Approval request sent: ${approval.id}`,
      agentId,
      { approval_type: approvalType }
    );

    return approval.id;
  }

  /**
   * Wait for approval response
   */
  async waitForApproval(
    approvalId: string,
    timeoutMs: number = config.security.approvalTimeoutMs
  ): Promise<ApprovalStatus> {
    await this.logger.approval(`Waiting for approval: ${approvalId}`);

    const startTime = Date.now();
    const pollIntervalMs = 5000; // Poll every 5 seconds

    while (Date.now() - startTime < timeoutMs) {
      const approval = await this.memoryEngine.getApproval(approvalId);

      if (!approval) {
        throw new Error(`Approval ${approvalId} not found`);
      }

      if (approval.status !== ApprovalStatus.PENDING) {
        await this.logger.approval(
          `Approval ${approvalId} ${approval.status}`,
          approval.agent_id,
          {
            approved_by: approval.approved_by,
            status: approval.status,
          }
        );
        return approval.status;
      }

      // Wait before polling again
      await this.sleep(pollIntervalMs);
    }

    // Timeout
    await this.memoryEngine.updateApprovalStatus(
      approvalId,
      ApprovalStatus.TIMEOUT
    );

    await this.logger.warning(`Approval ${approvalId} timed out`);

    return ApprovalStatus.TIMEOUT;
  }

  /**
   * Process approval response (called by Telegram interface)
   */
  async processApproval(
    approvalId: string,
    status: ApprovalStatus,
    approvedBy: string,
    notes?: string
  ): Promise<void> {
    await this.logger.approval(
      `Processing approval ${approvalId}: ${status}`,
      undefined,
      { approved_by: approvedBy }
    );

    await this.memoryEngine.updateApprovalStatus(
      approvalId,
      status,
      approvedBy,
      undefined,
      notes
    );

    const approval = await this.memoryEngine.getApproval(approvalId);
    if (!approval) {
      return;
    }

    // Send confirmation
    if (status === ApprovalStatus.APPROVED) {
      await this.telegram.sendSuccess(
        approval.agent_id,
        `Approval ${approvalId} approved by ${approvedBy}`
      );
    } else if (status === ApprovalStatus.REJECTED) {
      await this.telegram.sendAlert(
        approval.agent_id,
        "Approval Rejected",
        `Approval ${approvalId} rejected by ${approvedBy}${notes ? `: ${notes}` : ""}`
      );
    }
  }

  /**
   * Request and wait for initial plan approval
   */
  async requestInitialPlanApproval(
    agentId: string,
    agentName: string,
    plan: InitialPlan,
    riskLevel: RiskLevel
  ): Promise<boolean> {
    if (!this.shouldRequestApproval(riskLevel, ApprovalType.INITIAL_PLAN)) {
      await this.logger.info(
        `Initial plan approval not required for ${agentName} (${riskLevel})`,
        agentId
      );
      return true;
    }

    // Truncate long text to avoid Telegram message limits
    const truncate = (text: string, maxLength: number = 200): string => {
      return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    };

    const details = `
Initial Plan:
- Purpose: ${truncate(plan.agent_purpose, 150)}
- Capabilities: ${plan.core_capabilities.slice(0, 3).join(", ")}${plan.core_capabilities.length > 3 ? "..." : ""}
- Tools: ${plan.required_tools.slice(0, 3).join(", ")}${plan.required_tools.length > 3 ? "..." : ""}
- Complexity: ${plan.estimated_complexity}
- Risk Level: ${riskLevel}

Reasoning: ${truncate(plan.reasoning, 300)}
    `;

    const approvalId = await this.requestApproval(
      agentId,
      agentName,
      ApprovalType.INITIAL_PLAN,
      details,
      { plan }
    );

    const status = await this.waitForApproval(approvalId);

    return status === ApprovalStatus.APPROVED;
  }

  /**
   * Request and wait for detailed plan approval
   */
  async requestDetailedPlanApproval(
    agentId: string,
    agentName: string,
    plan: DetailedPlan,
    riskLevel: RiskLevel
  ): Promise<boolean> {
    if (!this.shouldRequestApproval(riskLevel, ApprovalType.DETAILED_PLAN)) {
      await this.logger.info(
        `Detailed plan approval not required for ${agentName} (${riskLevel})`,
        agentId
      );
      return true;
    }

    // Truncate long text to avoid Telegram message limits
    const truncate = (text: string, maxLength: number = 200): string => {
      return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    };

    const details = `
Detailed Plan:
- Architecture: ${truncate(plan.architecture_design, 150)}
- Modules: ${plan.module_structure.length} modules
- Tools: ${plan.tools_integration_plan.length} integrations
- Storage: ${plan.memory_requirements.storage_backend}
- Deployment: ${plan.deployment_strategy.target}
- Monitoring: ${plan.monitoring_strategy.health_check_interval_ms}ms intervals

Security:
- Allowed Actions: ${plan.security_requirements.allowed_actions.slice(0, 5).join(", ")}${plan.security_requirements.allowed_actions.length > 5 ? "..." : ""}
- Approval Required: ${plan.security_requirements.approval_required_actions.slice(0, 3).join(", ")}${plan.security_requirements.approval_required_actions.length > 3 ? "..." : ""}
    `;

    const approvalId = await this.requestApproval(
      agentId,
      agentName,
      ApprovalType.DETAILED_PLAN,
      details,
      { plan }
    );

    const status = await this.waitForApproval(approvalId);

    return status === ApprovalStatus.APPROVED;
  }

  /**
   * Request and wait for security rules approval
   */
  async requestSecurityApproval(
    agentId: string,
    agentName: string,
    riskLevel: RiskLevel
  ): Promise<boolean> {
    if (!this.shouldRequestApproval(riskLevel, ApprovalType.SECURITY_RULES)) {
      await this.logger.info(
        `Security approval not required for ${agentName} (${riskLevel})`,
        agentId
      );
      return true;
    }

    const rules = await this.memoryEngine.getSecurityRules(agentId);

    const details = `
**Security Rules Defined:**
- Risk Level: ${riskLevel}
- Rules Count: ${rules.length}

Please review security rules in database before approving.
    `;

    const approvalId = await this.requestApproval(
      agentId,
      agentName,
      ApprovalType.SECURITY_RULES,
      details,
      { risk_level: riskLevel, rules_count: rules.length }
    );

    const status = await this.waitForApproval(approvalId);

    return status === ApprovalStatus.APPROVED;
  }

  /**
   * Request and wait for deployment approval
   */
  async requestDeploymentApproval(
    agentId: string,
    agentName: string,
    deploymentTarget: string,
    riskLevel: RiskLevel
  ): Promise<boolean> {
    if (!this.shouldRequestApproval(riskLevel, ApprovalType.DEPLOYMENT)) {
      await this.logger.info(
        `Deployment approval not required for ${agentName} (${riskLevel})`,
        agentId
      );
      return true;
    }

    const details = `
**Deployment Request:**
- Target: ${deploymentTarget}
- Risk Level: ${riskLevel}

Agent validation passed. Ready to deploy.
    `;

    const approvalId = await this.requestApproval(
      agentId,
      agentName,
      ApprovalType.DEPLOYMENT,
      details,
      { deployment_target: deploymentTarget }
    );

    const status = await this.waitForApproval(approvalId);

    return status === ApprovalStatus.APPROVED;
  }

  /**
   * Get all pending approvals
   */
  async getPendingApprovals(agentId?: string): Promise<Approval[]> {
    return await this.memoryEngine.getPendingApprovals(agentId);
  }

  /**
   * Cancel pending approval
   */
  async cancelApproval(approvalId: string, reason: string): Promise<void> {
    await this.memoryEngine.updateApprovalStatus(
      approvalId,
      ApprovalStatus.REJECTED,
      "system",
      undefined,
      `Cancelled: ${reason}`
    );

    await this.logger.approval(`Approval ${approvalId} cancelled: ${reason}`);
  }

  // Private helper methods
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
