import { MemoryEngine } from "./memory.engine";
import { Logger } from "./logger";
import {
  RiskLevel,
  SecurityRequirements,
  DetailedPlan,
  GeneratedAgent,
} from "../types";

export class SecurityEngine {
  private memoryEngine: MemoryEngine;
  private logger: Logger;

  constructor(memoryEngine: MemoryEngine, logger: Logger) {
    this.memoryEngine = memoryEngine;
    this.logger = logger;
  }

  /**
   * Define security rules for an agent based on its detailed plan
   */
  async defineSecurityRules(
    agentId: string,
    plan: DetailedPlan
  ): Promise<SecurityRequirements> {
    await this.logger.security(
      `Defining security rules for agent: ${plan.agent_name}`,
      agentId
    );

    const securityRequirements = plan.security_requirements;

    // Enhance with additional security checks
    const enhancedRequirements = this.enhanceSecurityRequirements(
      securityRequirements,
      plan
    );

    // Save to database
    await this.memoryEngine.saveSecurityRules(
      agentId,
      "base_security",
      enhancedRequirements
    );

    await this.logger.security(
      `Security rules defined: ${enhancedRequirements.allowed_actions.length} allowed actions, ${enhancedRequirements.forbidden_actions.length} forbidden actions`,
      agentId
    );

    return enhancedRequirements;
  }

  /**
   * Classify the risk level of an agent based on its capabilities
   */
  classifyRiskLevel(plan: DetailedPlan): RiskLevel {
    let riskScore = 0;

    // Check filesystem access
    if (
      plan.security_requirements.filesystem_access_rules.write_allowed_paths
        .length > 0
    ) {
      riskScore += 1;
    }

    // Check network access
    if (
      plan.tools_integration_plan.some((tool) => tool.network_access_required)
    ) {
      riskScore += 1;
    }

    // Check credential access
    if (
      plan.tools_integration_plan.some((tool) => tool.credentials_required)
    ) {
      riskScore += 2;
    }

    // Check for sensitive actions
    const sensitiveActions = [
      "execute_command",
      "delete_files",
      "modify_system",
      "access_credentials",
      "network_request",
    ];

    const hasSensitiveActions =
      plan.security_requirements.allowed_actions.some((action) =>
        sensitiveActions.includes(action)
      );

    if (hasSensitiveActions) {
      riskScore += 2;
    }

    // Check deployment target
    if (
      plan.deployment_strategy.target === "cloud" ||
      plan.deployment_strategy.target === "server"
    ) {
      riskScore += 1;
    }

    // Classify based on score
    if (riskScore === 0) {
      return RiskLevel.SAFE;
    } else if (riskScore <= 2) {
      return RiskLevel.MODERATE;
    } else if (riskScore <= 4) {
      return RiskLevel.SENSITIVE;
    } else {
      return RiskLevel.CRITICAL;
    }
  }

  /**
   * Check if a specific action requires approval
   */
  requiresApproval(action: string, securityRequirements: SecurityRequirements): boolean {
    return securityRequirements.approval_required_actions.includes(action);
  }

  /**
   * Validate if generated code complies with security requirements
   */
  async validateSecurityCompliance(
    agentId: string,
    generatedAgent: GeneratedAgent
  ): Promise<{ compliant: boolean; violations: string[] }> {
    await this.logger.security(
      `Validating security compliance for ${generatedAgent.agent_name}`,
      agentId
    );

    const rules = await this.memoryEngine.getSecurityRules(agentId);
    if (rules.length === 0) {
      await this.logger.warning(
        "No security rules found, skipping validation",
        agentId
      );
      return { compliant: true, violations: [] };
    }

    const violations: string[] = [];
    const baseRules = rules.find((r) => r.rule_type === "base_security");

    if (!baseRules) {
      return { compliant: true, violations: [] };
    }

    const securityReqs = baseRules.rule_data as SecurityRequirements;

    // Check each generated file for violations
    for (const file of generatedAgent.files) {
      if (file.type === "TS") {
        const fileViolations = this.checkCodeViolations(
          file.content,
          file.path,
          securityReqs
        );
        violations.push(...fileViolations);
      }
    }

    const compliant = violations.length === 0;

    if (!compliant) {
      await this.logger.security(
        `Security violations found: ${violations.length}`,
        agentId,
        { violations }
      );
    } else {
      await this.logger.security(
        "Security compliance validated successfully",
        agentId
      );
    }

    return { compliant, violations };
  }

  /**
   * Check if risk level requires approval
   */
  riskLevelRequiresApproval(riskLevel: RiskLevel): boolean {
    return riskLevel !== RiskLevel.SAFE;
  }

  // Private helper methods
  private enhanceSecurityRequirements(
    requirements: SecurityRequirements,
    plan: DetailedPlan
  ): SecurityRequirements {
    const enhanced = { ...requirements };

    // Add default forbidden actions if not specified
    const defaultForbidden = [
      "eval",
      "exec",
      "child_process.exec",
      "child_process.spawn",
      "fs.rmSync",
      "fs.rmdirSync",
      "fs.unlinkSync",
      "process.exit",
      "require('child_process')",
    ];

    enhanced.forbidden_actions = [
      ...new Set([...enhanced.forbidden_actions, ...defaultForbidden]),
    ];

    // Ensure system paths are forbidden
    const systemPaths = [
      "/etc",
      "/sys",
      "/root",
      "/bin",
      "/sbin",
      "/usr/bin",
      "/usr/sbin",
      "C:\\Windows",
      "C:\\Program Files",
    ];

    enhanced.filesystem_access_rules.forbidden_paths = [
      ...new Set([
        ...enhanced.filesystem_access_rules.forbidden_paths,
        ...systemPaths,
      ]),
    ];

    // Add approval requirements based on tools
    for (const tool of plan.tools_integration_plan) {
      if (tool.credentials_required) {
        enhanced.approval_required_actions.push(`access_${tool.tool_name}_credentials`);
      }
      if (tool.network_access_required) {
        enhanced.approval_required_actions.push(`network_request_${tool.tool_name}`);
      }
    }

    // Deduplicate approval required actions
    enhanced.approval_required_actions = [...new Set(enhanced.approval_required_actions)];

    return enhanced;
  }

  private checkCodeViolations(
    code: string,
    filePath: string,
    securityReqs: SecurityRequirements
  ): string[] {
    const violations: string[] = [];

    // Check for forbidden actions
    for (const forbidden of securityReqs.forbidden_actions) {
      if (code.includes(forbidden)) {
        violations.push(
          `Forbidden action "${forbidden}" found in ${filePath}`
        );
      }
    }

    // Check for eval usage
    if (/\beval\s*\(/.test(code)) {
      violations.push(`Use of eval() detected in ${filePath}`);
    }

    // Check for Function constructor
    if (/new\s+Function\s*\(/.test(code)) {
      violations.push(`Use of Function constructor detected in ${filePath}`);
    }

    // Check for child_process usage
    if (/require\s*\(\s*['"]child_process['"]\s*\)/.test(code)) {
      violations.push(`Use of child_process module detected in ${filePath}`);
    }

    // Check for fs dangerous operations
    const dangerousFs = [
      "unlinkSync",
      "rmdirSync",
      "rmSync",
      "unlink",
      "rmdir",
    ];
    for (const op of dangerousFs) {
      if (new RegExp(`fs\\.${op}\\s*\\(`).test(code)) {
        violations.push(`Dangerous fs operation ${op}() detected in ${filePath}`);
      }
    }

    // Check for process.exit
    if (/process\.exit\s*\(/.test(code)) {
      violations.push(`Use of process.exit() detected in ${filePath}`);
    }

    // Check for forbidden paths access
    for (const forbiddenPath of securityReqs.filesystem_access_rules
      .forbidden_paths) {
      if (code.includes(forbiddenPath)) {
        violations.push(
          `Access to forbidden path "${forbiddenPath}" detected in ${filePath}`
        );
      }
    }

    // Check for hardcoded credentials
    const credentialPatterns = [
      /password\s*=\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
      /secret\s*=\s*['"][^'"]+['"]/i,
      /token\s*=\s*['"][^'"]+['"]/i,
    ];

    for (const pattern of credentialPatterns) {
      if (pattern.test(code)) {
        violations.push(`Potential hardcoded credential detected in ${filePath}`);
      }
    }

    return violations;
  }

  /**
   * Generate a security report for an agent
   */
  async generateSecurityReport(agentId: string): Promise<string> {
    const agent = await this.memoryEngine.getAgent(agentId);
    if (!agent) {
      return "Agent not found";
    }

    const rules = await this.memoryEngine.getSecurityRules(agentId);
    const securityLogs = await this.memoryEngine.getLogs(
      agentId,
      undefined,
      undefined,
      100
    );

    let report = `Security Report for Agent: ${agent.name}\n\n`;
    report += `Risk Level: ${agent.risk_level}\n`;
    report += `Status: ${agent.status}\n\n`;

    report += `Security Rules (${rules.length} total):\n`;
    for (const rule of rules) {
      report += `  - ${rule.rule_type} (v${rule.version}, ${rule.enabled ? "enabled" : "disabled"})\n`;
    }

    report += `\nSecurity Events: ${securityLogs.length} total\n`;

    return report;
  }
}
