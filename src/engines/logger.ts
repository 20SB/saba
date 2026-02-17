import * as winston from "winston";
import * as path from "path";
import * as fs from "fs";
import chalk from "chalk";
import { MemoryEngine } from "./memory.engine";
import { LogType, LogLevel } from "../types";
import { config } from "../config";

export class Logger {
  private winstonLogger: winston.Logger;
  private memoryEngine: MemoryEngine;

  constructor(memoryEngine: MemoryEngine) {
    this.memoryEngine = memoryEngine;

    // Ensure logs directory exists
    if (!fs.existsSync(config.paths.logsPath)) {
      fs.mkdirSync(config.paths.logsPath, { recursive: true });
    }

    // Create winston logger
    this.winstonLogger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        // Console transport with colors
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let metaStr = "";
              if (Object.keys(meta).length > 0) {
                metaStr = `\n${JSON.stringify(meta, null, 2)}`;
              }
              return `${chalk.gray(timestamp)} [${level}] ${message}${metaStr}`;
            })
          ),
        }),
        // File transport - all logs
        new winston.transports.File({
          filename: path.join(config.paths.logsPath, "saba.log"),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
        // File transport - errors only
        new winston.transports.File({
          filename: path.join(config.paths.logsPath, "errors.log"),
          level: "error",
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
      ],
    });
  }

  private async persistLog(
    logType: LogType,
    level: LogLevel,
    message: string,
    agentId?: string,
    metadata?: Record<string, any>,
    errorStack?: string
  ): Promise<void> {
    try {
      await this.memoryEngine.log(
        logType,
        level,
        message,
        agentId,
        metadata,
        errorStack
      );
    } catch (error) {
      // Don't throw if database logging fails, just log to winston
      this.winstonLogger.error("Failed to persist log to database", { error });
    }
  }

  // Info level logging
  async info(
    message: string,
    agentId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.winstonLogger.info(message, { agentId, ...metadata });
    await this.persistLog(LogType.INFO, LogLevel.INFO, message, agentId, metadata);
  }

  // Warning level logging
  async warning(
    message: string,
    agentId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.winstonLogger.warn(message, { agentId, ...metadata });
    await this.persistLog(
      LogType.WARNING,
      LogLevel.WARNING,
      message,
      agentId,
      metadata
    );
  }

  // Error level logging
  async error(
    message: string,
    error?: Error,
    agentId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const errorStack = error?.stack;
    const errorMeta = {
      ...metadata,
      errorName: error?.name,
      errorMessage: error?.message,
    };

    this.winstonLogger.error(message, { agentId, ...errorMeta, stack: errorStack });
    await this.persistLog(
      LogType.ERROR,
      LogLevel.ERROR,
      message,
      agentId,
      errorMeta,
      errorStack
    );
  }

  // Security event logging
  async security(
    message: string,
    agentId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.winstonLogger.warn(`[SECURITY] ${message}`, { agentId, ...metadata });
    await this.persistLog(
      LogType.SECURITY,
      LogLevel.WARNING,
      message,
      agentId,
      metadata
    );
  }

  // Approval event logging
  async approval(
    message: string,
    agentId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.winstonLogger.info(`[APPROVAL] ${message}`, { agentId, ...metadata });
    await this.persistLog(
      LogType.APPROVAL,
      LogLevel.INFO,
      message,
      agentId,
      metadata
    );
  }

  // State transition logging
  async stateTransition(
    message: string,
    agentId: string,
    fromState: string,
    toState: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const fullMessage = `State transition: ${fromState} → ${toState} - ${message}`;
    const fullMetadata = { ...metadata, fromState, toState };

    this.winstonLogger.info(fullMessage, { agentId, ...fullMetadata });
    await this.persistLog(
      LogType.STATE_TRANSITION,
      LogLevel.INFO,
      fullMessage,
      agentId,
      fullMetadata
    );
  }

  // Generation event logging
  async generation(
    message: string,
    agentId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.winstonLogger.info(`[GENERATION] ${message}`, { agentId, ...metadata });
    await this.persistLog(
      LogType.GENERATION,
      LogLevel.INFO,
      message,
      agentId,
      metadata
    );
  }

  // Validation event logging
  async validation(
    message: string,
    agentId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.winstonLogger.info(`[VALIDATION] ${message}`, { agentId, ...metadata });
    await this.persistLog(
      LogType.VALIDATION,
      LogLevel.INFO,
      message,
      agentId,
      metadata
    );
  }

  // Deployment event logging
  async deployment(
    message: string,
    agentId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.winstonLogger.info(`[DEPLOYMENT] ${message}`, { agentId, ...metadata });
    await this.persistLog(
      LogType.DEPLOYMENT,
      LogLevel.INFO,
      message,
      agentId,
      metadata
    );
  }

  // Monitoring event logging
  async monitoring(
    message: string,
    agentId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.winstonLogger.info(`[MONITORING] ${message}`, { agentId, ...metadata });
    await this.persistLog(
      LogType.MONITORING,
      LogLevel.INFO,
      message,
      agentId,
      metadata
    );
  }

  // Get logs from database
  async getAgentLogs(
    agentId: string,
    logType?: LogType,
    level?: LogLevel,
    limit: number = 100
  ) {
    return await this.memoryEngine.getLogs(agentId, logType, level, limit);
  }

  // Get system logs
  async getSystemLogs(
    logType?: LogType,
    level?: LogLevel,
    limit: number = 100
  ) {
    return await this.memoryEngine.getLogs(undefined, logType, level, limit);
  }

  // Get recent errors
  async getRecentErrors(agentId?: string, limit: number = 10) {
    return await this.memoryEngine.getRecentErrors(agentId, limit);
  }
}
