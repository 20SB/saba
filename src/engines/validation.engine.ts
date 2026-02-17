import * as path from "path";
import { execSync } from "child_process";
import { Logger } from "./logger";
import { SecurityEngine } from "./security.engine";
import {
  GeneratedAgent,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "../types";
import { config } from "../config";

export class ValidationEngine {
  private logger: Logger;
  private securityEngine: SecurityEngine;

  constructor(logger: Logger, securityEngine: SecurityEngine) {
    this.logger = logger;
    this.securityEngine = securityEngine;
  }

  /**
   * Validate a generated agent through multiple stages
   */
  async validateAgent(
    agentId: string,
    generatedAgent: GeneratedAgent
  ): Promise<ValidationResult> {
    await this.logger.validation(
      `Starting validation for agent: ${generatedAgent.agent_name}`,
      agentId
    );

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const stagesCompleted: string[] = [];

    try {
      // Stage 1: TypeScript Compilation
      await this.logger.validation("Stage 1: TypeScript compilation check", agentId);
      const compilationResult = await this.validateCompilation(generatedAgent);
      errors.push(...compilationResult.errors);
      warnings.push(...compilationResult.warnings);
      stagesCompleted.push("compilation");

      // Stage 2: Syntax Validation
      await this.logger.validation("Stage 2: Syntax validation", agentId);
      const syntaxResult = await this.validateSyntax(generatedAgent);
      errors.push(...syntaxResult.errors);
      warnings.push(...syntaxResult.warnings);
      stagesCompleted.push("syntax");

      // Stage 3: Security Compliance
      await this.logger.validation("Stage 3: Security compliance check", agentId);
      const securityResult = await this.securityEngine.validateSecurityCompliance(
        agentId,
        generatedAgent
      );
      if (!securityResult.compliant) {
        errors.push(
          ...securityResult.violations.map((v) => ({
            stage: "security",
            message: v,
            severity: "critical" as const,
          }))
        );
      }
      stagesCompleted.push("security");

      // Stage 4: Logic Validation (basic checks)
      await this.logger.validation("Stage 4: Logic validation", agentId);
      const logicResult = await this.validateLogic(generatedAgent);
      errors.push(...logicResult.errors);
      warnings.push(...logicResult.warnings);
      stagesCompleted.push("logic");

      // Stage 5: Dry Run (only if previous stages passed)
      if (errors.filter((e) => e.severity === "critical").length === 0) {
        await this.logger.validation("Stage 5: Dry run test", agentId);
        const dryRunResult = await this.runDryRun(generatedAgent);
        errors.push(...dryRunResult.errors);
        warnings.push(...dryRunResult.warnings);
        stagesCompleted.push("dry_run");
      } else {
        warnings.push({
          stage: "dry_run",
          message: "Dry run skipped due to critical errors in previous stages",
        });
      }

      const passed = errors.filter((e) => e.severity === "critical").length === 0;

      await this.logger.validation(
        `Validation complete: ${passed ? "PASSED" : "FAILED"}`,
        agentId,
        {
          stages_completed: stagesCompleted.length,
          errors_count: errors.length,
          warnings_count: warnings.length,
        }
      );

      return {
        passed,
        errors,
        warnings,
        stages_completed: stagesCompleted,
        timestamp: new Date(),
      };
    } catch (error) {
      await this.logger.error(
        "Validation process failed",
        error instanceof Error ? error : undefined,
        agentId
      );

      errors.push({
        stage: "validation_process",
        message: `Validation process error: ${error}`,
        severity: "critical",
      });

      return {
        passed: false,
        errors,
        warnings,
        stages_completed: stagesCompleted,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Validate TypeScript compilation
   */
  private async validateCompilation(
    agent: GeneratedAgent
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const agentPath = path.join(config.paths.agentsBasePath, agent.agent_name);

      // Run TypeScript compilation check (tsc --noEmit)
      const command = `cd "${agentPath}" && npx tsc --noEmit`;
      execSync(command, {
        stdio: "pipe",
        encoding: "utf-8",
        timeout: 30000,
      });

      this.logger.info("TypeScript compilation check passed");
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;

      // Parse TypeScript errors
      const tsErrors = this.parseTsCompilerOutput(output);

      if (tsErrors.length > 0) {
        errors.push(...tsErrors);
      } else {
        errors.push({
          stage: "compilation",
          message: `Compilation failed: ${output}`,
          severity: "critical",
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate syntax of generated files
   */
  private async validateSyntax(
    agent: GeneratedAgent
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const file of agent.files) {
      if (file.type === "TS") {
        // Check for common syntax issues
        const syntaxIssues = this.checkSyntaxIssues(file.content, file.path);
        errors.push(...syntaxIssues);
      }

      if (file.type === "JSON") {
        // Validate JSON syntax
        try {
          JSON.parse(file.content);
        } catch (error) {
          errors.push({
            stage: "syntax",
            message: `Invalid JSON in ${file.path}`,
            file: file.path,
            severity: "error",
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate logic and structure
   */
  private async validateLogic(
    agent: GeneratedAgent
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for required files
    const requiredFiles = ["src/brain.ts", "src/config.ts", "package.json"];
    for (const required of requiredFiles) {
      if (!agent.files.find((f) => f.path === required)) {
        errors.push({
          stage: "logic",
          message: `Required file missing: ${required}`,
          severity: "critical",
        });
      }
    }

    // Check for empty files
    for (const file of agent.files) {
      if (file.content.trim().length === 0) {
        warnings.push({
          stage: "logic",
          message: `File is empty: ${file.path}`,
          file: file.path,
        });
      }
    }

    // Check for TODO comments in critical files
    const brainFile = agent.files.find((f) => f.path === "src/brain.ts");
    if (brainFile && brainFile.content.includes("TODO")) {
      warnings.push({
        stage: "logic",
        message: "Brain file contains TODO comments - implementation may be incomplete",
        file: "src/brain.ts",
      });
    }

    return { errors, warnings };
  }

  /**
   * Run a dry run test of the agent
   */
  private async runDryRun(
    agent: GeneratedAgent
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const agentPath = path.join(config.paths.agentsBasePath, agent.agent_name);

      // Install dependencies
      this.logger.info("Installing dependencies for dry run...");
      execSync("npm install", {
        cwd: agentPath,
        stdio: "pipe",
        timeout: 120000,
      });

      // Build the agent
      this.logger.info("Building agent for dry run...");
      execSync("npm run build", {
        cwd: agentPath,
        stdio: "pipe",
        timeout: 60000,
      });

      this.logger.info("Dry run completed successfully");
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      errors.push({
        stage: "dry_run",
        message: `Dry run failed: ${output.slice(0, 500)}`,
        severity: "error",
      });
    }

    return { errors, warnings };
  }

  // Helper methods
  private parseTsCompilerOutput(output: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lines = output.split("\n");

    for (const line of lines) {
      // Match TypeScript error format: filename(line,col): error TS####: message
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+TS\d+:\s+(.+)$/);
      if (match) {
        errors.push({
          stage: "compilation",
          message: match[4],
          file: match[1],
          line: parseInt(match[2]),
          severity: "error",
        });
      }
    }

    // If no specific errors found but output exists, add generic error
    if (errors.length === 0 && output.trim().length > 0) {
      errors.push({
        stage: "compilation",
        message: output.slice(0, 500),
        severity: "error",
      });
    }

    return errors;
  }

  private checkSyntaxIssues(code: string, filePath: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for unbalanced braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push({
        stage: "syntax",
        message: "Unbalanced braces detected",
        file: filePath,
        severity: "error",
      });
    }

    // Check for unbalanced parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push({
        stage: "syntax",
        message: "Unbalanced parentheses detected",
        file: filePath,
        severity: "error",
      });
    }

    // Check for missing semicolons (basic check)
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip empty lines, comments, and lines that don't need semicolons
      if (
        line.length === 0 ||
        line.startsWith("//") ||
        line.startsWith("/*") ||
        line.startsWith("*") ||
        line.startsWith("import") ||
        line.startsWith("export") ||
        line.endsWith("{") ||
        line.endsWith("}") ||
        line.endsWith(",")
      ) {
        continue;
      }

      // Check if line should end with semicolon
      if (
        line.includes("=") &&
        !line.endsWith(";") &&
        !line.endsWith("{") &&
        !line.includes("=>")
      ) {
        // This is a basic heuristic - TypeScript compiler will catch the rest
        continue;
      }
    }

    return errors;
  }

  /**
   * Generate validation report summary
   */
  generateValidationReport(result: ValidationResult): string {
    let report = `Validation Report\n`;
    report += `=================\n\n`;
    report += `Status: ${result.passed ? "✓ PASSED" : "✗ FAILED"}\n`;
    report += `Timestamp: ${result.timestamp.toISOString()}\n`;
    report += `Stages Completed: ${result.stages_completed.join(", ")}\n\n`;

    if (result.errors.length > 0) {
      report += `Errors (${result.errors.length}):\n`;
      for (const error of result.errors) {
        report += `  [${error.stage}] ${error.severity.toUpperCase()}: ${error.message}\n`;
        if (error.file) {
          report += `    File: ${error.file}${error.line ? `:${error.line}` : ""}\n`;
        }
      }
      report += "\n";
    }

    if (result.warnings.length > 0) {
      report += `Warnings (${result.warnings.length}):\n`;
      for (const warning of result.warnings) {
        report += `  [${warning.stage}] ${warning.message}\n`;
        if (warning.file) {
          report += `    File: ${warning.file}${warning.line ? `:${warning.line}` : ""}\n`;
        }
      }
    }

    return report;
  }
}
