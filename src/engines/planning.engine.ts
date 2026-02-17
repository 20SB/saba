import Anthropic from "@anthropic-ai/sdk";
import { MemoryEngine } from "./memory.engine";
import { Logger } from "./logger";
import { config } from "../config";
import {
  AgentRequest,
  InitialPlan,
  DetailedPlan,
  RiskLevel,
  ModuleDefinition,
  ToolIntegration,
  MemoryRequirements,
  SecurityRequirements,
  FailureHandling,
  DeploymentStrategy,
  MonitoringStrategy,
  DeploymentTarget,
  LogLevel,
} from "../types";

export class PlanningEngine {
  private anthropic: Anthropic;
  private memoryEngine: MemoryEngine;
  private logger: Logger;

  constructor(memoryEngine: MemoryEngine, logger: Logger) {
    this.anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
    this.memoryEngine = memoryEngine;
    this.logger = logger;
  }

  /**
   * Create initial high-level plan for an agent
   */
  async createInitialPlan(
    agentId: string,
    request: AgentRequest
  ): Promise<InitialPlan> {
    await this.logger.info(
      `Creating initial plan for agent: ${request.name}`,
      agentId
    );

    const prompt = this.buildInitialPlanPrompt(request);

    try {
      const message = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 4096,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";
      const plan = this.parseInitialPlanResponse(responseText, request);

      // Save plan to database
      await this.memoryEngine.savePlan(agentId, "initial", plan);

      await this.logger.info(
        `Initial plan created: ${plan.agent_purpose}`,
        agentId,
        { risk_level: plan.risk_level, complexity: plan.estimated_complexity }
      );

      return plan;
    } catch (error) {
      await this.logger.error(
        "Failed to create initial plan",
        error instanceof Error ? error : undefined,
        agentId
      );
      throw error;
    }
  }

  /**
   * Create detailed architectural plan for an agent
   */
  async createDetailedPlan(
    agentId: string,
    request: AgentRequest,
    initialPlan: InitialPlan
  ): Promise<DetailedPlan> {
    await this.logger.info(
      `Creating detailed plan for agent: ${request.name}`,
      agentId
    );

    const prompt = this.buildDetailedPlanPrompt(request, initialPlan);

    try {
      const message = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 8192,
        temperature: 0.5,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";
      const plan = this.parseDetailedPlanResponse(responseText, request, initialPlan);

      // Save plan to database
      await this.memoryEngine.savePlan(agentId, "detailed", plan);

      await this.logger.info(
        `Detailed plan created with ${plan.module_structure.length} modules`,
        agentId
      );

      return plan;
    } catch (error) {
      await this.logger.error(
        "Failed to create detailed plan",
        error instanceof Error ? error : undefined,
        agentId
      );
      throw error;
    }
  }

  /**
   * Modify an existing plan based on feedback
   */
  async modifyPlan(
    agentId: string,
    planType: "initial" | "detailed",
    feedback: string
  ): Promise<InitialPlan | DetailedPlan> {
    await this.logger.info(`Modifying ${planType} plan based on feedback`, agentId);

    const existingPlan = await this.memoryEngine.getPlan(agentId, planType);
    if (!existingPlan) {
      throw new Error(`No ${planType} plan found for agent ${agentId}`);
    }

    const prompt = `
You are modifying an existing agent plan based on user feedback.

Current Plan:
${JSON.stringify(existingPlan.plan_data, null, 2)}

User Feedback:
${feedback}

Please provide an updated plan that addresses the feedback while maintaining consistency with the overall design. Return the complete updated plan in JSON format.
    `;

    try {
      const message = await this.anthropic.messages.create({
        model: config.anthropic.model,
        max_tokens: 8192,
        temperature: 0.5,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";

      // Parse the modified plan
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      const modifiedPlan = jsonMatch
        ? JSON.parse(jsonMatch[1])
        : existingPlan.plan_data;

      // Update plan in database
      await this.memoryEngine.updatePlan(existingPlan.id, modifiedPlan, true);

      await this.logger.info(`${planType} plan modified successfully`, agentId);

      return modifiedPlan;
    } catch (error) {
      await this.logger.error(
        "Failed to modify plan",
        error instanceof Error ? error : undefined,
        agentId
      );
      throw error;
    }
  }

  // Private helper methods
  private buildInitialPlanPrompt(request: AgentRequest): string {
    return `
You are an AI architect designing a new autonomous agent. Analyze the following agent request and create a high-level initial plan.

Agent Request:
- Name: ${request.name}
- Goal: ${request.goal}
- Type: ${request.agent_type || "general-purpose"}
- Required Tools: ${request.required_tools?.join(", ") || "none specified"}
- Required Permissions: ${request.required_permissions?.join(", ") || "none specified"}

Please provide:
1. A clear description of the agent's purpose
2. Core capabilities the agent needs
3. Required tools and integrations
4. Estimated complexity (low/medium/high)
5. Risk level assessment (SAFE/MODERATE/SENSITIVE/CRITICAL)
6. Required permissions
7. Whether human approval is required
8. Reasoning for your decisions

Consider:
- Security implications
- Resource requirements
- Potential failure modes
- Integration complexity

Return your response in the following JSON format:
\`\`\`json
{
  "agent_purpose": "Clear description of what this agent does",
  "core_capabilities": ["capability1", "capability2"],
  "required_tools": ["tool1", "tool2"],
  "estimated_complexity": "low|medium|high",
  "risk_level": "SAFE|MODERATE|SENSITIVE|CRITICAL",
  "required_permissions": ["permission1", "permission2"],
  "human_approval_required": true|false,
  "reasoning": "Explanation of key design decisions"
}
\`\`\`
    `;
  }

  private buildDetailedPlanPrompt(
    request: AgentRequest,
    initialPlan: InitialPlan
  ): string {
    return `
You are an AI architect creating a detailed technical implementation plan for an autonomous agent.

Agent Request:
- Name: ${request.name}
- Goal: ${request.goal}

Initial Plan Summary:
- Purpose: ${initialPlan.agent_purpose}
- Core Capabilities: ${initialPlan.core_capabilities.join(", ")}
- Risk Level: ${initialPlan.risk_level}

Create a detailed architectural plan with:

1. **Architecture Design**: Overall system architecture and design patterns
2. **Module Structure**: List of modules (name, purpose, dependencies, exports)
3. **Tools Integration**: How external tools will be integrated
4. **Memory Requirements**: Storage needs and memory architecture
5. **Security Requirements**: Access controls, allowed/forbidden actions, approval requirements
6. **Failure Handling**: Error handling and recovery strategies
7. **Deployment Strategy**: How the agent will be deployed
8. **Monitoring Strategy**: Health checks, metrics, alerts

Return your response in the following JSON format:
\`\`\`json
{
  "agent_name": "${request.name}",
  "architecture_design": "Description of overall architecture",
  "module_structure": [
    {
      "name": "module_name",
      "purpose": "What this module does",
      "dependencies": ["dep1", "dep2"],
      "exports": ["export1", "export2"]
    }
  ],
  "tools_integration_plan": [
    {
      "tool_name": "tool_name",
      "purpose": "Why this tool is needed",
      "api_requirements": ["requirement1"],
      "credentials_required": true|false,
      "network_access_required": true|false
    }
  ],
  "memory_requirements": {
    "persistent_storage": true|false,
    "memory_type": "short-term|long-term|both",
    "storage_backend": "postgres|json|redis|vector-db",
    "estimated_storage_size": "size estimate"
  },
  "security_requirements": {
    "allowed_actions": ["action1", "action2"],
    "forbidden_actions": ["action1", "action2"],
    "tool_permissions": {
      "tool_name": ["permission1", "permission2"]
    },
    "filesystem_access_rules": {
      "allowed_paths": ["/path1"],
      "forbidden_paths": ["/path2"],
      "read_only_paths": ["/path3"],
      "write_allowed_paths": ["/path4"]
    },
    "network_access_rules": {
      "allowed_domains": ["domain1.com"],
      "forbidden_domains": ["domain2.com"],
      "allowed_ports": [80, 443],
      "require_https": true
    },
    "credential_access_rules": {
      "allowed_credential_types": ["api_key"],
      "credential_storage": "env|vault|encrypted-file",
      "require_approval_for_access": true|false
    },
    "approval_required_actions": ["action1"]
  },
  "failure_handling_strategy": {
    "retry_strategy": "immediate|exponential-backoff|manual",
    "max_retries": 3,
    "error_notification": true,
    "automatic_recovery": true|false
  },
  "deployment_strategy": {
    "target": "local|docker|cloud|vm|server",
    "containerized": true|false,
    "resource_limits": {
      "cpu_limit": "limit",
      "memory_limit": "limit",
      "disk_limit": "limit"
    },
    "environment_variables": {
      "VAR_NAME": "description"
    },
    "health_check_endpoint": "/health"
  },
  "monitoring_strategy": {
    "health_check_interval_ms": 60000,
    "metrics_to_track": ["metric1", "metric2"],
    "alert_conditions": [
      {
        "metric": "metric_name",
        "threshold": 100,
        "comparison": ">",
        "action": "notify|restart|pause|escalate"
      }
    ],
    "log_level": "INFO|WARNING|ERROR|CRITICAL"
  }
}
\`\`\`
    `;
  }

  private parseInitialPlanResponse(
    response: string,
    request: AgentRequest
  ): InitialPlan {
    try {
      // Extract JSON from markdown code block
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) {
        throw new Error("Failed to parse initial plan response");
      }

      const parsed = JSON.parse(jsonMatch[1]);

      return {
        agent_purpose: parsed.agent_purpose || request.goal,
        core_capabilities: parsed.core_capabilities || [],
        required_tools: parsed.required_tools || request.required_tools || [],
        estimated_complexity: parsed.estimated_complexity || "medium",
        risk_level: parsed.risk_level || RiskLevel.SAFE,
        required_permissions:
          parsed.required_permissions || request.required_permissions || [],
        human_approval_required: parsed.human_approval_required !== false,
        reasoning: parsed.reasoning || "No reasoning provided",
      };
    } catch (error) {
      this.logger.error(
        "Failed to parse initial plan response",
        error instanceof Error ? error : undefined
      );
      // Return a default safe plan
      return {
        agent_purpose: request.goal,
        core_capabilities: ["basic execution"],
        required_tools: request.required_tools || [],
        estimated_complexity: "medium",
        risk_level: RiskLevel.MODERATE,
        required_permissions: request.required_permissions || [],
        human_approval_required: true,
        reasoning: "Failed to parse LLM response, using defaults",
      };
    }
  }

  private parseDetailedPlanResponse(
    response: string,
    request: AgentRequest,
    initialPlan: InitialPlan
  ): DetailedPlan {
    try {
      // Extract JSON from markdown code block
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) {
        throw new Error("Failed to parse detailed plan response");
      }

      const parsed = JSON.parse(jsonMatch[1]);

      return {
        agent_name: parsed.agent_name || request.name,
        architecture_design: parsed.architecture_design || "Standard agent architecture",
        module_structure: parsed.module_structure || [],
        tools_integration_plan: parsed.tools_integration_plan || [],
        memory_requirements: parsed.memory_requirements || {
          persistent_storage: false,
          memory_type: "short-term",
          storage_backend: "json",
          estimated_storage_size: "< 1MB",
        },
        security_requirements: parsed.security_requirements || this.getDefaultSecurityRequirements(),
        failure_handling_strategy: parsed.failure_handling_strategy || {
          retry_strategy: "exponential-backoff",
          max_retries: 3,
          error_notification: true,
          automatic_recovery: false,
        },
        deployment_strategy: parsed.deployment_strategy || {
          target: DeploymentTarget.LOCAL,
          containerized: false,
          environment_variables: {},
        },
        monitoring_strategy: parsed.monitoring_strategy || {
          health_check_interval_ms: 60000,
          metrics_to_track: ["health", "errors"],
          alert_conditions: [],
          log_level: LogLevel.INFO,
        },
      };
    } catch (error) {
      this.logger.error(
        "Failed to parse detailed plan response",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  private getDefaultSecurityRequirements(): SecurityRequirements {
    return {
      allowed_actions: ["read_config", "log"],
      forbidden_actions: ["execute_system_command", "delete_files"],
      tool_permissions: {},
      filesystem_access_rules: {
        allowed_paths: ["./logs", "./config"],
        forbidden_paths: ["/etc", "/sys", "/root"],
        read_only_paths: ["./config"],
        write_allowed_paths: ["./logs"],
      },
      network_access_rules: {
        allowed_domains: [],
        forbidden_domains: [],
        allowed_ports: [80, 443],
        require_https: true,
      },
      credential_access_rules: {
        allowed_credential_types: [],
        credential_storage: "env",
        require_approval_for_access: true,
      },
      approval_required_actions: ["network_access", "file_write"],
    };
  }
}
