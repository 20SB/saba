/**
 * TypeScript and code validation utilities
 */

export class Validator {
  /**
   * Validate agent name format
   */
  static isValidAgentName(name: string): boolean {
    // Must be lowercase alphanumeric with hyphens, 3-50 characters
    const pattern = /^[a-z0-9-]{3,50}$/;
    return pattern.test(name);
  }

  /**
   * Validate environment variable name
   */
  static isValidEnvVar(name: string): boolean {
    // Must be uppercase alphanumeric with underscores
    const pattern = /^[A-Z_][A-Z0-9_]*$/;
    return pattern.test(name);
  }

  /**
   * Validate file path safety
   */
  static isSafeFilePath(filePath: string): boolean {
    // Reject paths with:
    // - Parent directory references (..)
    // - Absolute paths starting with / or drive letters
    // - Null bytes
    if (
      filePath.includes("..") ||
      filePath.startsWith("/") ||
      filePath.match(/^[a-zA-Z]:/) ||
      filePath.includes("\0")
    ) {
      return false;
    }

    return true;
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate port number
   */
  static isValidPort(port: number): boolean {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
  }

  /**
   * Check if string contains potential code injection
   */
  static hasPotentialInjection(input: string): boolean {
    const dangerousPatterns = [
      /eval\s*\(/i,
      /exec\s*\(/i,
      /Function\s*\(/i,
      /require\s*\(\s*['"]child_process['"]\s*\)/i,
      /\$\{.*\}/,
      /`.*\$\{.*\}.*`/,
    ];

    return dangerousPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Sanitize user input
   */
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, "") // Remove event handlers
      .trim();
  }

  /**
   * Validate JSON string
   */
  static isValidJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate TypeScript identifier
   */
  static isValidTsIdentifier(name: string): boolean {
    // Must start with letter or underscore, contain only alphanumeric and underscores
    const pattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

    // Check if it's a reserved keyword
    const reservedKeywords = [
      "break",
      "case",
      "catch",
      "class",
      "const",
      "continue",
      "debugger",
      "default",
      "delete",
      "do",
      "else",
      "export",
      "extends",
      "finally",
      "for",
      "function",
      "if",
      "import",
      "in",
      "instanceof",
      "new",
      "return",
      "super",
      "switch",
      "this",
      "throw",
      "try",
      "typeof",
      "var",
      "void",
      "while",
      "with",
      "yield",
      "let",
      "static",
      "enum",
      "await",
      "implements",
      "interface",
      "package",
      "private",
      "protected",
      "public",
    ];

    return pattern.test(name) && !reservedKeywords.includes(name);
  }

  /**
   * Check if code contains dangerous patterns
   */
  static hasDangerousCode(code: string): {
    dangerous: boolean;
    patterns: string[];
  } {
    const dangerousPatterns = [
      { pattern: /eval\s*\(/g, name: "eval()" },
      { pattern: /Function\s*\(/g, name: "Function constructor" },
      { pattern: /exec\s*\(/g, name: "exec()" },
      { pattern: /spawn\s*\(/g, name: "spawn()" },
      { pattern: /child_process/g, name: "child_process module" },
      { pattern: /fs\.unlink/g, name: "fs.unlink()" },
      { pattern: /fs\.rmdir/g, name: "fs.rmdir()" },
      { pattern: /fs\.rm\(/g, name: "fs.rm()" },
      { pattern: /process\.exit/g, name: "process.exit()" },
      { pattern: /__dirname/g, name: "__dirname usage" },
    ];

    const found: string[] = [];

    for (const { pattern, name } of dangerousPatterns) {
      if (pattern.test(code)) {
        found.push(name);
      }
    }

    return {
      dangerous: found.length > 0,
      patterns: found,
    };
  }
}
