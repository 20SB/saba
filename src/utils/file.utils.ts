import * as fs from "fs-extra";
import * as path from "path";

/**
 * File system utilities with safety checks
 */
export class FileUtils {
  /**
   * Safely read file with path validation
   */
  static async readFileSafe(
    filePath: string,
    basePath?: string
  ): Promise<string> {
    const safePath = this.validatePath(filePath, basePath);
    return await fs.readFile(safePath, "utf-8");
  }

  /**
   * Safely write file with path validation
   */
  static async writeFileSafe(
    filePath: string,
    content: string,
    basePath?: string
  ): Promise<void> {
    const safePath = this.validatePath(filePath, basePath);

    // Ensure parent directory exists
    await fs.ensureDir(path.dirname(safePath));

    await fs.writeFile(safePath, content, "utf-8");
  }

  /**
   * Safely check if file exists
   */
  static async existsSafe(filePath: string, basePath?: string): Promise<boolean> {
    try {
      const safePath = this.validatePath(filePath, basePath);
      return await fs.pathExists(safePath);
    } catch {
      return false;
    }
  }

  /**
   * Safely delete file
   */
  static async deleteSafe(filePath: string, basePath?: string): Promise<void> {
    const safePath = this.validatePath(filePath, basePath);
    await fs.remove(safePath);
  }

  /**
   * Safely create directory
   */
  static async mkdirSafe(dirPath: string, basePath?: string): Promise<void> {
    const safePath = this.validatePath(dirPath, basePath);
    await fs.ensureDir(safePath);
  }

  /**
   * Safely list directory contents
   */
  static async listDirSafe(
    dirPath: string,
    basePath?: string
  ): Promise<string[]> {
    const safePath = this.validatePath(dirPath, basePath);
    return await fs.readdir(safePath);
  }

  /**
   * Safely copy file or directory
   */
  static async copySafe(
    src: string,
    dest: string,
    basePath?: string
  ): Promise<void> {
    const safeSrc = this.validatePath(src, basePath);
    const safeDest = this.validatePath(dest, basePath);

    await fs.copy(safeSrc, safeDest);
  }

  /**
   * Get file size in bytes
   */
  static async getFileSize(
    filePath: string,
    basePath?: string
  ): Promise<number> {
    const safePath = this.validatePath(filePath, basePath);
    const stats = await fs.stat(safePath);
    return stats.size;
  }

  /**
   * Get directory size recursively
   */
  static async getDirSize(
    dirPath: string,
    basePath?: string
  ): Promise<number> {
    const safePath = this.validatePath(dirPath, basePath);

    let totalSize = 0;

    const files = await fs.readdir(safePath);

    for (const file of files) {
      const filePath = path.join(safePath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        totalSize += await this.getDirSize(filePath);
      } else {
        totalSize += stats.size;
      }
    }

    return totalSize;
  }

  /**
   * Format bytes to human-readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Validate and normalize file path
   */
  private static validatePath(filePath: string, basePath?: string): string {
    // Normalize path
    let normalized = path.normalize(filePath);

    // If base path provided, resolve relative to it
    if (basePath) {
      normalized = path.resolve(basePath, normalized);

      // Ensure path is within base path
      const relative = path.relative(basePath, normalized);

      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Path is outside base directory: ${filePath}`);
      }
    }

    // Check for dangerous patterns
    if (
      filePath.includes("..") &&
      !path.isAbsolute(normalized) &&
      !basePath
    ) {
      throw new Error(`Dangerous path detected: ${filePath}`);
    }

    return normalized;
  }

  /**
   * Check if path is safe (no directory traversal)
   */
  static isSafePath(filePath: string, basePath?: string): boolean {
    try {
      this.validatePath(filePath, basePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file extension
   */
  static getExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * Check if file is text-based
   */
  static isTextFile(filePath: string): boolean {
    const textExtensions = [
      ".txt",
      ".md",
      ".ts",
      ".js",
      ".json",
      ".yaml",
      ".yml",
      ".xml",
      ".html",
      ".css",
      ".sql",
      ".sh",
      ".env",
    ];

    const ext = this.getExtension(filePath);
    return textExtensions.includes(ext);
  }

  /**
   * Ensure directory exists, create if not
   */
  static async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  /**
   * Read JSON file safely
   */
  static async readJsonSafe<T = any>(
    filePath: string,
    basePath?: string
  ): Promise<T> {
    const content = await this.readFileSafe(filePath, basePath);
    return JSON.parse(content);
  }

  /**
   * Write JSON file safely
   */
  static async writeJsonSafe(
    filePath: string,
    data: any,
    basePath?: string
  ): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await this.writeFileSafe(filePath, content, basePath);
  }
}
