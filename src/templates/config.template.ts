import * as dotenv from "dotenv";

dotenv.config();

export interface Config {
  agent: {
    name: string;
    version: string;
  };

  {{CONFIG_SECTIONS}}

  logging: {
    level: string;
    directory: string;
  };

  monitoring: {
    enabled: boolean;
    healthCheckInterval: number;
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(\`Missing required environment variable: \${key}\`);
  }
  return value || defaultValue!;
}

function getEnvVarNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(\`Environment variable \${key} must be a number\`);
  }
  return parsed;
}

export function loadConfig(): Config {
  return {
    agent: {
      name: "{{AGENT_NAME}}",
      version: "1.0.0",
    },

    {{CONFIG_VALUES}}

    logging: {
      level: getEnvVar("LOG_LEVEL", "INFO"),
      directory: getEnvVar("LOG_DIR", "./logs"),
    },

    monitoring: {
      enabled: getEnvVar("MONITORING_ENABLED", "true") === "true",
      healthCheckInterval: getEnvVarNumber("HEALTH_CHECK_INTERVAL", 60000),
    },
  };
}
