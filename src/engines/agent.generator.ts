import * as fs from "fs-extra";
import * as path from "path";
import { Logger } from "./logger";
import { MemoryEngine } from "./memory.engine";
import {
  DetailedPlan,
  GeneratedAgent,
  GeneratedFile,
  ToolIntegration,
} from "../types";
import { config } from "../config";

export class AgentGenerator {
  private logger: Logger;
  private memoryEngine: MemoryEngine;
  private templatesPath: string;
  private agentsBasePath: string;

  constructor(logger: Logger, memoryEngine: MemoryEngine) {
    this.logger = logger;
    this.memoryEngine = memoryEngine;
    this.templatesPath = path.join(__dirname, "../templates");
    this.agentsBasePath = config.paths.agentsBasePath;
  }

  /**
   * Generate a complete agent from a detailed plan
   */
  async generateAgent(
    agentId: string,
    plan: DetailedPlan
  ): Promise<GeneratedAgent> {
    await this.logger.generation(
      `Starting agent generation: ${plan.agent_name}`,
      agentId
    );

    try {
      const agentPath = path.join(this.agentsBasePath, plan.agent_name);

      // Check if agent directory already exists
      if (fs.existsSync(agentPath)) {
        throw new Error(
          `Agent directory already exists: ${agentPath}`
        );
      }

      // Generate all files
      const files: GeneratedFile[] = [];

      files.push(await this.generateBrainFile(plan));
      files.push(await this.generateConfigFile(plan));
      files.push(await this.generateLoggerFile(plan));
      files.push(await this.generateMemoryFile(plan));
      files.push(await this.generateSecurityFile(plan));
      files.push(await this.generateMonitorFile(plan));
      files.push(await this.generatePackageJson(plan));
      files.push(await this.generateTsConfigJson(plan));
      files.push(await this.generateEnvFile(plan));
      files.push(await this.generateDockerfile(plan));
      files.push(await this.generateReadme(plan));

      // Generate tool connectors
      const toolFiles = await this.generateToolFiles(plan);
      files.push(...toolFiles);

      // Define folder structure
      const folderStructure = [
        "src",
        "src/tools",
        "src/memory",
        "src/security",
        "src/monitor",
        "logs",
        "memory",
        "dist",
      ];

      const generatedAgent: GeneratedAgent = {
        agent_name: plan.agent_name,
        files,
        folder_structure: folderStructure,
      };

      // Write files to disk
      await this.writeAgentToDisk(generatedAgent);

      await this.logger.generation(
        `Agent generation complete: ${plan.agent_name}`,
        agentId,
        { files_count: files.length }
      );

      return generatedAgent;
    } catch (error) {
      await this.logger.error(
        "Agent generation failed",
        error instanceof Error ? error : undefined,
        agentId
      );
      throw error;
    }
  }

  /**
   * Write generated agent to disk
   */
  private async writeAgentToDisk(agent: GeneratedAgent): Promise<void> {
    const agentPath = path.join(this.agentsBasePath, agent.agent_name);

    // Create base directory
    await fs.ensureDir(agentPath);

    // Create folder structure
    for (const folder of agent.folder_structure) {
      await fs.ensureDir(path.join(agentPath, folder));
    }

    // Write all files
    for (const file of agent.files) {
      const filePath = path.join(agentPath, file.path);
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, file.content, "utf-8");
    }

    this.logger.info(`Agent written to disk: ${agentPath}`);
  }

  // File generation methods
  private async generateBrainFile(plan: DetailedPlan): Promise<GeneratedFile> {
    const template = await this.readTemplate("brain.template.ts");

    // Generate tool imports
    const toolImports = plan.tools_integration_plan
      .map((tool) => `import { ${this.toPascalCase(tool.tool_name)}Tool } from "./tools/${tool.tool_name}";`)
      .join("\n");

    // Generate tool declarations
    const toolDeclarations = plan.tools_integration_plan
      .map((tool) => `private ${tool.tool_name}Tool: ${this.toPascalCase(tool.tool_name)}Tool;`)
      .join("\n  ");

    // Generate tool initializations
    const toolInitializations = plan.tools_integration_plan
      .map((tool) => `this.${tool.tool_name}Tool = new ${this.toPascalCase(tool.tool_name)}Tool(this.config, this.logger);`)
      .join("\n    ");

    // Generate agent logic
    const agentLogic = this.generateAgentLogic(plan);

    const content = template
      .replace(/\{\{AGENT_NAME\}\}/g, this.toPascalCase(plan.agent_name))
      .replace(/\{\{TOOL_IMPORTS\}\}/g, toolImports || "// No tools")
      .replace(/\{\{TOOL_DECLARATIONS\}\}/g, toolDeclarations || "// No tools")
      .replace(/\{\{TOOL_INITIALIZATIONS\}\}/g, toolInitializations || "// No tools")
      .replace(/\{\{AGENT_LOGIC\}\}/g, agentLogic)
      .replace(/\{\{EXECUTION_INTERVAL_MS\}\}/g, "10000");

    return {
      path: "src/brain.ts",
      content,
      type: "TS",
    };
  }

  private async generateConfigFile(plan: DetailedPlan): Promise<GeneratedFile> {
    const template = await this.readTemplate("config.template.ts");

    // Generate config sections
    const configSections = this.generateConfigSections(plan);
    const configValues = this.generateConfigValues(plan);

    const content = template
      .replace(/\{\{AGENT_NAME\}\}/g, plan.agent_name)
      .replace(/\{\{CONFIG_SECTIONS\}\}/g, configSections)
      .replace(/\{\{CONFIG_VALUES\}\}/g, configValues);

    return {
      path: "src/config.ts",
      content,
      type: "TS",
    };
  }

  private async generateLoggerFile(plan: DetailedPlan): Promise<GeneratedFile> {
    const template = await this.readTemplate("logger.template.ts");

    const content = template.replace(/\{\{AGENT_NAME\}\}/g, plan.agent_name);

    return {
      path: "src/logger.ts",
      content,
      type: "TS",
    };
  }

  private async generateMemoryFile(plan: DetailedPlan): Promise<GeneratedFile> {
    const template = await this.readTemplate("memory.template.ts");

    return {
      path: "src/memory/manager.ts",
      content: template,
      type: "TS",
    };
  }

  private async generateSecurityFile(plan: DetailedPlan): Promise<GeneratedFile> {
    const template = await this.readTemplate("security.template.ts");

    const allowedActions = JSON.stringify(
      plan.security_requirements.allowed_actions
    );
    const forbiddenActions = JSON.stringify(
      plan.security_requirements.forbidden_actions
    );

    const securityValidations = this.generateSecurityValidations(plan);

    const content = template
      .replace(/\{\{ALLOWED_ACTIONS\}\}/g, allowedActions)
      .replace(/\{\{FORBIDDEN_ACTIONS\}\}/g, forbiddenActions)
      .replace(/\{\{SECURITY_VALIDATIONS\}\}/g, securityValidations);

    return {
      path: "src/security/enforcer.ts",
      content,
      type: "TS",
    };
  }

  private async generateMonitorFile(plan: DetailedPlan): Promise<GeneratedFile> {
    const template = await this.readTemplate("monitor.template.ts");

    return {
      path: "src/monitor/service.ts",
      content: template,
      type: "TS",
    };
  }

  private async generatePackageJson(plan: DetailedPlan): Promise<GeneratedFile> {
    const template = await this.readTemplate("package.template.json");

    // Generate additional dependencies based on tools
    const additionalDeps = this.generateAdditionalDependencies(plan);

    const content = template
      .replace(/\{\{AGENT_NAME\}\}/g, plan.agent_name)
      .replace(/\{\{AGENT_DESCRIPTION\}\}/g, plan.architecture_design)
      .replace(/\{\{ADDITIONAL_DEPENDENCIES\}\}/g, additionalDeps);

    return {
      path: "package.json",
      content,
      type: "JSON",
    };
  }

  private async generateTsConfigJson(plan: DetailedPlan): Promise<GeneratedFile> {
    const template = await this.readTemplate("tsconfig.template.json");

    return {
      path: "tsconfig.json",
      content: template,
      type: "JSON",
    };
  }

  private async generateEnvFile(plan: DetailedPlan): Promise<GeneratedFile> {
    const template = await this.readTemplate(".env.template");

    const customEnvVars = this.generateCustomEnvVars(plan);

    const content = template
      .replace(/\{\{AGENT_NAME\}\}/g, plan.agent_name)
      .replace(/\{\{CUSTOM_ENV_VARS\}\}/g, customEnvVars);

    return {
      path: ".env.example",
      content,
      type: "MD",
    };
  }

  private async generateDockerfile(plan: DetailedPlan): Promise<GeneratedFile> {
    const template = await this.readTemplate("dockerfile.template");

    const envVariables = Object.keys(plan.deployment_strategy.environment_variables)
      .map((key) => `ENV ${key}=`)
      .join("\n");

    const content = template
      .replace(/\{\{AGENT_NAME\}\}/g, plan.agent_name)
      .replace(/\{\{ENV_VARIABLES\}\}/g, envVariables);

    return {
      path: "Dockerfile",
      content,
      type: "DOCKERFILE",
    };
  }

  private async generateReadme(plan: DetailedPlan): Promise<GeneratedFile> {
    const content = `# ${plan.agent_name}

${plan.architecture_design}

## Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Configure environment variables:
\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

3. Build the agent:
\`\`\`bash
npm run build
\`\`\`

4. Run the agent:
\`\`\`bash
npm start
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Architecture

${plan.module_structure.map((m) => `- **${m.name}**: ${m.purpose}`).join("\n")}

## Tools

${plan.tools_integration_plan.map((t) => `- **${t.tool_name}**: ${t.purpose}`).join("\n")}

## Security

- Risk Level: Based on SABA security classification
- Allowed Actions: ${plan.security_requirements.allowed_actions.join(", ")}
- Approval Required: ${plan.security_requirements.approval_required_actions.join(", ")}

## Monitoring

- Health Check Interval: ${plan.monitoring_strategy.health_check_interval_ms}ms
- Metrics Tracked: ${plan.monitoring_strategy.metrics_to_track.join(", ")}

---

Generated by SABA (ShelfEx Agent Builder Agent)
`;

    return {
      path: "README.md",
      content,
      type: "MD",
    };
  }

  private async generateToolFiles(plan: DetailedPlan): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    for (const tool of plan.tools_integration_plan) {
      const content = this.generateToolFile(tool);
      files.push({
        path: `src/tools/${tool.tool_name}.ts`,
        content,
        type: "TS",
      });
    }

    return files;
  }

  private generateToolFile(tool: ToolIntegration): string {
    return `import { Config } from "../config";
import { Logger } from "../logger";

export class ${this.toPascalCase(tool.tool_name)}Tool {
  private config: Config;
  private logger: Logger;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * ${tool.purpose}
   */
  async execute(params: any): Promise<any> {
    this.logger.info("Executing ${tool.tool_name} tool", { params });

    try {
      // TODO: Implement ${tool.tool_name} logic
      throw new Error("${tool.tool_name} tool not yet implemented");
    } catch (error) {
      this.logger.error("${tool.tool_name} tool execution failed", error instanceof Error ? error : undefined);
      throw error;
    }
  }
}
`;
  }

  // Helper methods
  private async readTemplate(filename: string): Promise<string> {
    const filePath = path.join(this.templatesPath, filename);
    return await fs.readFile(filePath, "utf-8");
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  }

  private generateAgentLogic(plan: DetailedPlan): string {
    return `// Agent logic based on plan
        // Purpose: ${plan.architecture_design}

        // TODO: Implement agent-specific logic
        this.logger.info("Agent iteration executing...");

        // Example: Execute tools
        ${plan.tools_integration_plan
          .map((tool) => `// await this.${tool.tool_name}Tool.execute({});`)
          .join("\n        ")}`;
  }

  private generateConfigSections(plan: DetailedPlan): string {
    const sections: string[] = [];

    // Add tool-specific config sections
    for (const tool of plan.tools_integration_plan) {
      if (tool.api_requirements && tool.api_requirements.length > 0) {
        sections.push(`${tool.tool_name}: {
    apiKey: string;
  };`);
      }
    }

    return sections.join("\n\n  ");
  }

  private generateConfigValues(plan: DetailedPlan): string {
    const values: string[] = [];

    // Add tool-specific config values
    for (const tool of plan.tools_integration_plan) {
      if (tool.api_requirements && tool.api_requirements.length > 0) {
        values.push(`${tool.tool_name}: {
      apiKey: getEnvVar("${tool.tool_name.toUpperCase()}_API_KEY"),
    },`);
      }
    }

    return values.join("\n\n    ");
  }

  private generateSecurityValidations(plan: DetailedPlan): string {
    const validations: string[] = [];

    // Validate network access if required
    if (plan.tools_integration_plan.some((t) => t.network_access_required)) {
      validations.push(`// Validate network access permissions`);
    }

    // Validate credentials if required
    if (plan.tools_integration_plan.some((t) => t.credentials_required)) {
      validations.push(`// Validate credential access permissions`);
    }

    return validations.join("\n    ") || "// No additional validations required";
  }

  private generateAdditionalDependencies(plan: DetailedPlan): string {
    const deps: string[] = [];

    // Add tool-specific dependencies
    for (const tool of plan.tools_integration_plan) {
      if (tool.tool_name.includes("http") || tool.tool_name.includes("api")) {
        deps.push(`"axios": "^1.6.0"`);
      }
    }

    // Add database dependencies if needed
    if (plan.memory_requirements.storage_backend === "postgres") {
      deps.push(`"pg": "^8.11.3"`);
    }

    if (deps.length === 0) {
      return "";
    }

    return `,
    ${[...new Set(deps)].join(",\n    ")}`;
  }

  private generateCustomEnvVars(plan: DetailedPlan): string {
    const vars: string[] = [];

    // Add tool-specific env vars
    for (const tool of plan.tools_integration_plan) {
      if (tool.credentials_required) {
        vars.push(`# ${tool.tool_name} Configuration`);
        vars.push(`${tool.tool_name.toUpperCase()}_API_KEY=your_api_key_here`);
        vars.push("");
      }
    }

    return vars.join("\n");
  }
}
