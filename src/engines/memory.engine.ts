import { Pool } from "pg";
import { getPool } from "../database/connection";
import {
  Agent,
  AgentState,
  Plan,
  Approval,
  ApprovalType,
  ApprovalStatus,
  LogEntry,
  LogType,
  LogLevel,
  SecurityRule,
  RiskLevel,
  DeploymentTarget,
  AgentRequest,
} from "../types";

export class MemoryEngine {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  // Agent Operations
  async createAgent(request: AgentRequest): Promise<Agent> {
    const query = `
      INSERT INTO agents (name, goal, status, risk_level, deployment_target, agent_type, required_tools, required_permissions)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      request.name,
      request.goal,
      AgentState.REQUESTED,
      RiskLevel.SAFE,
      request.deployment_target || DeploymentTarget.LOCAL,
      request.agent_type || null,
      request.required_tools || [],
      request.required_permissions || [],
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    const query = "SELECT * FROM agents WHERE id = $1";
    const result = await this.pool.query(query, [agentId]);
    return result.rows[0] || null;
  }

  async getAgentByName(name: string): Promise<Agent | null> {
    const query = "SELECT * FROM agents WHERE name = $1";
    const result = await this.pool.query(query, [name]);
    return result.rows[0] || null;
  }

  async getAllAgents(): Promise<Agent[]> {
    const query = "SELECT * FROM agents ORDER BY created_at DESC";
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getAgentsByStatus(status: AgentState): Promise<Agent[]> {
    const query = "SELECT * FROM agents WHERE status = $1 ORDER BY created_at DESC";
    const result = await this.pool.query(query, [status]);
    return result.rows;
  }

  async updateAgentState(agentId: string, newState: AgentState): Promise<void> {
    const query = "UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2";
    await this.pool.query(query, [newState, agentId]);
  }

  async updateAgentRiskLevel(agentId: string, riskLevel: RiskLevel): Promise<void> {
    const query = "UPDATE agents SET risk_level = $1, updated_at = NOW() WHERE id = $2";
    await this.pool.query(query, [riskLevel, agentId]);
  }

  async updateAgentMetadata(
    agentId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    const query = "UPDATE agents SET metadata = $1, updated_at = NOW() WHERE id = $2";
    await this.pool.query(query, [JSON.stringify(metadata), agentId]);
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.updateAgentState(agentId, AgentState.DELETED);
  }

  // Plan Operations
  async savePlan(
    agentId: string,
    planType: string,
    planData: Record<string, any>
  ): Promise<Plan> {
    const query = `
      INSERT INTO plans (agent_id, plan_type, plan_data)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const values = [agentId, planType, JSON.stringify(planData)];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getPlan(agentId: string, planType: string): Promise<Plan | null> {
    const query = `
      SELECT * FROM plans
      WHERE agent_id = $1 AND plan_type = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [agentId, planType]);
    return result.rows[0] || null;
  }

  async getAllPlans(agentId: string): Promise<Plan[]> {
    const query = "SELECT * FROM plans WHERE agent_id = $1 ORDER BY created_at DESC";
    const result = await this.pool.query(query, [agentId]);
    return result.rows;
  }

  async updatePlan(
    planId: string,
    planData: Record<string, any>,
    incrementVersion: boolean = true
  ): Promise<void> {
    const query = incrementVersion
      ? "UPDATE plans SET plan_data = $1, version = version + 1, updated_at = NOW() WHERE id = $2"
      : "UPDATE plans SET plan_data = $1, updated_at = NOW() WHERE id = $2";

    await this.pool.query(query, [JSON.stringify(planData), planId]);
  }

  // Approval Operations
  async createApproval(
    agentId: string,
    approvalType: ApprovalType,
    requestData?: Record<string, any>,
    telegramMessageId?: string
  ): Promise<Approval> {
    const query = `
      INSERT INTO approvals (agent_id, approval_type, status, request_data, telegram_message_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      agentId,
      approvalType,
      ApprovalStatus.PENDING,
      requestData ? JSON.stringify(requestData) : "{}",
      telegramMessageId || null,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getApproval(approvalId: string): Promise<Approval | null> {
    const query = "SELECT * FROM approvals WHERE id = $1";
    const result = await this.pool.query(query, [approvalId]);
    return result.rows[0] || null;
  }

  async getPendingApprovals(agentId?: string): Promise<Approval[]> {
    const query = agentId
      ? "SELECT * FROM approvals WHERE status = $1 AND agent_id = $2 ORDER BY requested_at ASC"
      : "SELECT * FROM approvals WHERE status = $1 ORDER BY requested_at ASC";

    const values = agentId
      ? [ApprovalStatus.PENDING, agentId]
      : [ApprovalStatus.PENDING];

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async updateApprovalStatus(
    approvalId: string,
    status: ApprovalStatus,
    approvedBy?: string,
    responseData?: Record<string, any>,
    notes?: string
  ): Promise<void> {
    const query = `
      UPDATE approvals
      SET status = $1, approved_by = $2, response_data = $3, approval_notes = $4, responded_at = NOW()
      WHERE id = $5
    `;

    const values = [
      status,
      approvedBy || null,
      responseData ? JSON.stringify(responseData) : "{}",
      notes || null,
      approvalId,
    ];

    await this.pool.query(query, values);
  }

  // Log Operations
  async log(
    logType: LogType,
    level: LogLevel,
    message: string,
    agentId?: string,
    metadata?: Record<string, any>,
    errorStack?: string
  ): Promise<LogEntry> {
    const query = `
      INSERT INTO logs (agent_id, log_type, level, message, metadata, error_stack)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      agentId || null,
      logType,
      level,
      message,
      metadata ? JSON.stringify(metadata) : "{}",
      errorStack || null,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getLogs(
    agentId?: string,
    logType?: LogType,
    level?: LogLevel,
    limit: number = 100
  ): Promise<LogEntry[]> {
    let query = "SELECT * FROM logs WHERE 1=1";
    const values: any[] = [];
    let paramCount = 1;

    if (agentId) {
      query += ` AND agent_id = $${paramCount}`;
      values.push(agentId);
      paramCount++;
    }

    if (logType) {
      query += ` AND log_type = $${paramCount}`;
      values.push(logType);
      paramCount++;
    }

    if (level) {
      query += ` AND level = $${paramCount}`;
      values.push(level);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async getRecentErrors(agentId?: string, limit: number = 10): Promise<LogEntry[]> {
    return this.getLogs(agentId, undefined, LogLevel.ERROR, limit);
  }

  // Security Rules Operations
  async saveSecurityRules(
    agentId: string,
    ruleType: string,
    ruleData: Record<string, any>
  ): Promise<SecurityRule> {
    const query = `
      INSERT INTO security_rules (agent_id, rule_type, rule_data)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const values = [agentId, ruleType, JSON.stringify(ruleData)];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getSecurityRules(agentId: string, ruleType?: string): Promise<SecurityRule[]> {
    const query = ruleType
      ? "SELECT * FROM security_rules WHERE agent_id = $1 AND rule_type = $2 AND enabled = true"
      : "SELECT * FROM security_rules WHERE agent_id = $1 AND enabled = true";

    const values = ruleType ? [agentId, ruleType] : [agentId];
    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async updateSecurityRule(
    ruleId: string,
    ruleData: Record<string, any>,
    incrementVersion: boolean = true
  ): Promise<void> {
    const query = incrementVersion
      ? "UPDATE security_rules SET rule_data = $1, version = version + 1, updated_at = NOW() WHERE id = $2"
      : "UPDATE security_rules SET rule_data = $1, updated_at = NOW() WHERE id = $2";

    await this.pool.query(query, [JSON.stringify(ruleData), ruleId]);
  }

  async disableSecurityRule(ruleId: string): Promise<void> {
    const query = "UPDATE security_rules SET enabled = false, updated_at = NOW() WHERE id = $1";
    await this.pool.query(query, [ruleId]);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }
}
