import { Config } from "../config";
import { Logger } from "../logger";

export interface SecurityValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class SecurityEnforcer {
  private config: Config;
  private logger: Logger;
  private allowedActions: Set<string>;
  private forbiddenActions: Set<string>;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Security rules from SABA
    this.allowedActions = new Set({{ALLOWED_ACTIONS}});
    this.forbiddenActions = new Set({{FORBIDDEN_ACTIONS}});
  }

  async validateConfiguration(): Promise<SecurityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate configuration security
    {{SECURITY_VALIDATIONS}}

    const valid = errors.length === 0;

    if (!valid) {
      this.logger.error("Security validation failed", undefined, { errors });
    } else if (warnings.length > 0) {
      this.logger.warn("Security warnings detected", { warnings });
    } else {
      this.logger.info("Security validation passed");
    }

    return { valid, errors, warnings };
  }

  canPerformAction(action: string): boolean {
    // Check if action is explicitly forbidden
    if (this.forbiddenActions.has(action)) {
      this.logger.warn(\`Attempted forbidden action: \${action}\`);
      return false;
    }

    // Check if action is allowed (default deny if not in allowed list)
    if (this.allowedActions.size > 0 && !this.allowedActions.has(action)) {
      this.logger.warn(\`Attempted unauthorized action: \${action}\`);
      return false;
    }

    return true;
  }

  enforceAction(action: string): void {
    if (!this.canPerformAction(action)) {
      throw new Error(\`Security violation: Action '\${action}' is not permitted\`);
    }
  }

  logSecurityEvent(event: string, details: Record<string, any>): void {
    this.logger.warn(\`[SECURITY] \${event}\`, details);
  }
}
