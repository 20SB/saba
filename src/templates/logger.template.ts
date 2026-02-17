import * as winston from "winston";
import * as path from "path";
import * as fs from "fs";
import { Config } from "../config";

export class Logger {
  private logger: winston.Logger;

  constructor(config: Config) {
    // Ensure logs directory exists
    if (!fs.existsSync(config.logging.directory)) {
      fs.mkdirSync(config.logging.directory, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: config.logging.level.toLowerCase(),
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let metaStr = "";
              if (Object.keys(meta).length > 0) {
                metaStr = \` \${JSON.stringify(meta)}\`;
              }
              return \`\${timestamp} [\${level}] \${message}\${metaStr}\`;
            })
          ),
        }),
        new winston.transports.File({
          filename: path.join(config.logging.directory, "{{AGENT_NAME}}.log"),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join(config.logging.directory, "errors.log"),
          level: "error",
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
      ],
    });
  }

  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    this.logger.error(message, { ...meta, error: error?.message, stack: error?.stack });
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }
}
