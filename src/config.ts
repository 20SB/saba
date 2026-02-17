import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config();

export interface Config {
  // Database
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };

  // Anthropic API
  anthropic: {
    apiKey: string;
    model: string;
  };

  // Telegram
  telegram: {
    botToken: string;
    adminChatId: string;
  };

  // Paths
  paths: {
    agentsBasePath: string;
    logsPath: string;
    memoryPath: string;
  };

  // Monitoring
  monitoring: {
    healthCheckIntervalMs: number;
    alertErrorThreshold: number;
    alertMemoryThresholdPercent: number;
  };

  // Deployment
  deployment: {
    defaultTarget: string;
    dockerRegistry: string;
  };

  // Security
  security: {
    maxRetryAttempts: number;
    approvalTimeoutMs: number;
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
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
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

export function loadConfig(): Config {
  return {
    database: {
      host: getEnvVar("DB_HOST", "localhost"),
      port: getEnvVarNumber("DB_PORT", 5432),
      user: getEnvVar("DB_USER", "saba"),
      password: getEnvVar("DB_PASSWORD", ""),
      database: getEnvVar("DB_NAME", "saba_db"),
    },

    anthropic: {
      apiKey: getEnvVar("ANTHROPIC_API_KEY"),
      model: getEnvVar("ANTHROPIC_MODEL", "claude-opus-4-6"),
    },

    telegram: {
      botToken: getEnvVar("TELEGRAM_BOT_TOKEN"),
      adminChatId: getEnvVar("TELEGRAM_ADMIN_CHAT_ID"),
    },

    paths: {
      agentsBasePath: path.resolve(
        getEnvVar("AGENTS_BASE_PATH", "./agents")
      ),
      logsPath: path.resolve(getEnvVar("LOGS_PATH", "./logs")),
      memoryPath: path.resolve(getEnvVar("MEMORY_PATH", "./memory")),
    },

    monitoring: {
      healthCheckIntervalMs: getEnvVarNumber(
        "HEALTH_CHECK_INTERVAL_MS",
        60000
      ),
      alertErrorThreshold: getEnvVarNumber("ALERT_ERROR_THRESHOLD", 10),
      alertMemoryThresholdPercent: getEnvVarNumber(
        "ALERT_MEMORY_THRESHOLD_PERCENT",
        90
      ),
    },

    deployment: {
      defaultTarget: getEnvVar("DEFAULT_DEPLOYMENT_TARGET", "local"),
      dockerRegistry: getEnvVar("DOCKER_REGISTRY", "localhost:5000"),
    },

    security: {
      maxRetryAttempts: getEnvVarNumber("MAX_RETRY_ATTEMPTS", 3),
      approvalTimeoutMs: getEnvVarNumber("APPROVAL_TIMEOUT_MS", 3600000),
    },
  };
}

export const config = loadConfig();
