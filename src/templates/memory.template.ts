import * as fs from "fs";
import * as path from "path";
import { Config } from "../config";
import { Logger } from "../logger";

export class MemoryManager {
  private config: Config;
  private logger: Logger;
  private memoryPath: string;
  private memory: Map<string, any>;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.memoryPath = path.join(process.cwd(), "memory");
    this.memory = new Map();
  }

  async initialize(): Promise<void> {
    // Ensure memory directory exists
    if (!fs.existsSync(this.memoryPath)) {
      fs.mkdirSync(this.memoryPath, { recursive: true });
    }

    // Load existing memory from disk
    await this.loadFromDisk();

    this.logger.info("Memory manager initialized");
  }

  async set(key: string, value: any): Promise<void> {
    this.memory.set(key, value);
    await this.saveToDisk();
  }

  get(key: string): any {
    return this.memory.get(key);
  }

  has(key: string): boolean {
    return this.memory.has(key);
  }

  async delete(key: string): Promise<void> {
    this.memory.delete(key);
    await this.saveToDisk();
  }

  async clear(): Promise<void> {
    this.memory.clear();
    await this.saveToDisk();
  }

  getAll(): Record<string, any> {
    return Object.fromEntries(this.memory);
  }

  async close(): Promise<void> {
    await this.saveToDisk();
    this.logger.info("Memory manager closed");
  }

  private async loadFromDisk(): Promise<void> {
    const filePath = path.join(this.memoryPath, "memory.json");

    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(data);
        this.memory = new Map(Object.entries(parsed));
        this.logger.info(\`Loaded \${this.memory.size} memory entries from disk\`);
      } catch (error) {
        this.logger.error("Failed to load memory from disk", error instanceof Error ? error : undefined);
      }
    }
  }

  private async saveToDisk(): Promise<void> {
    const filePath = path.join(this.memoryPath, "memory.json");

    try {
      const data = JSON.stringify(Object.fromEntries(this.memory), null, 2);
      fs.writeFileSync(filePath, data, "utf-8");
    } catch (error) {
      this.logger.error("Failed to save memory to disk", error instanceof Error ? error : undefined);
    }
  }
}
