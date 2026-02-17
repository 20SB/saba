import TelegramBot from "node-telegram-bot-api";
import { Logger } from "../engines/logger";
import { MemoryEngine } from "../engines/memory.engine";
import { StateManager } from "../engines/state.manager";
import { config } from "../config";
import { ApprovalStatus, ApprovalType } from "../types";

export interface TelegramConfig {
  botToken: string;
  adminChatId: string;
}

export class TelegramInterface {
  private bot: TelegramBot;
  private adminChatId: string;
  private logger: Logger;
  private memoryEngine: MemoryEngine;
  private stateManager: StateManager;
  private commandHandlers: Map<string, Function>;

  constructor(
    config: TelegramConfig,
    logger: Logger,
    memoryEngine: MemoryEngine,
    stateManager: StateManager
  ) {
    this.bot = new TelegramBot(config.botToken, { polling: true });
    this.adminChatId = config.adminChatId;
    this.logger = logger;
    this.memoryEngine = memoryEngine;
    this.stateManager = stateManager;
    this.commandHandlers = new Map();

    this.setupCommands();
  }

  private setupCommands(): void {
    // /start command
    this.bot.onText(/\/start/, async (msg) => {
      await this.handleStart(msg);
    });

    // /create_agent command: /create_agent <name> <goal>
    this.bot.onText(/\/create_agent (.+)/, async (msg, match) => {
      await this.handleCreateAgent(msg, match);
    });

    // /agents command - list all agents
    this.bot.onText(/\/agents/, async (msg) => {
      await this.handleListAgents(msg);
    });

    // /status command: /status <agent_name>
    this.bot.onText(/\/status(?:\s+(.+))?/, async (msg, match) => {
      await this.handleStatus(msg, match);
    });

    // /logs command: /logs <agent_name> [limit]
    this.bot.onText(/\/logs\s+(\S+)(?:\s+(\d+))?/, async (msg, match) => {
      await this.handleLogs(msg, match);
    });

    // /approve command
    this.bot.onText(/\/approve(?:\s+(.+))?/, async (msg, match) => {
      await this.handleApprove(msg, match);
    });

    // /reject command
    this.bot.onText(/\/reject(?:\s+(.+))?/, async (msg, match) => {
      await this.handleReject(msg, match);
    });

    // /stop command: /stop <agent_name>
    this.bot.onText(/\/stop\s+(.+)/, async (msg, match) => {
      await this.handleStop(msg, match);
    });

    // /start_agent command: /start_agent <agent_name>
    this.bot.onText(/\/start_agent\s+(.+)/, async (msg, match) => {
      await this.handleStartAgent(msg, match);
    });

    // /delete command: /delete <agent_name>
    this.bot.onText(/\/delete\s+(.+)/, async (msg, match) => {
      await this.handleDelete(msg, match);
    });

    // Handle callback queries (for inline buttons)
    this.bot.on("callback_query", async (query) => {
      await this.handleCallbackQuery(query);
    });

    // Error handling
    this.bot.on("polling_error", (error) => {
      this.logger.error("Telegram polling error", error instanceof Error ? error : undefined);
    });

    this.logger.info("Telegram bot commands initialized");
  }

  // Command Handlers
  private async handleStart(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id.toString();

    const welcomeMessage = `
🤖 *SABA - ShelfEx Agent Builder Agent*

I can help you create, manage, and monitor AI agents.

*Available Commands:*
/create_agent <name> <goal> - Create a new agent
/agents - List all agents
/status [agent_name] - Get agent status
/logs <agent_name> [limit] - View agent logs
/approve [approval_id] - Approve a request
/reject [approval_id] - Reject a request
/stop <agent_name> - Stop an agent
/start_agent <agent_name> - Start an agent
/delete <agent_name> - Delete an agent

*Example:*
\`/create_agent weather-bot Fetch weather data for users\`
    `;

    await this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
  }

  private async handleCreateAgent(
    msg: TelegramBot.Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id.toString();

    if (!match || !match[1]) {
      await this.bot.sendMessage(
        chatId,
        "Usage: /create_agent <name> <goal>\nExample: /create_agent weather-bot Fetch weather data"
      );
      return;
    }

    const input = match[1].trim();
    const parts = input.split(/\s+/);

    if (parts.length < 2) {
      await this.bot.sendMessage(
        chatId,
        "Please provide both agent name and goal.\nExample: /create_agent weather-bot Fetch weather data"
      );
      return;
    }

    const name = parts[0];
    const goal = parts.slice(1).join(" ");

    await this.bot.sendMessage(
      chatId,
      `✓ Agent creation request received:\n\n*Name:* ${name}\n*Goal:* ${goal}\n\nProcessing...`,
      { parse_mode: "Markdown" }
    );

    // Emit event (will be handled by orchestrator)
    this.emit("create_agent", { name, goal, chatId });
  }

  private async handleListAgents(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id.toString();

    try {
      const agents = await this.memoryEngine.getAllAgents();

      if (agents.length === 0) {
        await this.bot.sendMessage(chatId, "No agents found.");
        return;
      }

      let message = "*All Agents:*\n\n";
      for (const agent of agents) {
        const progress = this.stateManager.getStateProgress(agent.status);
        message += `📦 *${agent.name}*\n`;
        message += `   Status: ${agent.status} (${progress}%)\n`;
        message += `   Risk: ${agent.risk_level}\n`;
        message += `   Created: ${agent.created_at.toISOString()}\n\n`;
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error) {
      await this.logger.error("Error listing agents", error instanceof Error ? error : undefined);
      await this.bot.sendMessage(chatId, "Error retrieving agents list.");
    }
  }

  private async handleStatus(
    msg: TelegramBot.Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id.toString();
    const agentName = match?.[1]?.trim();

    if (!agentName) {
      await this.bot.sendMessage(
        chatId,
        "Usage: /status <agent_name>\nExample: /status weather-bot"
      );
      return;
    }

    try {
      const agent = await this.memoryEngine.getAgentByName(agentName);

      if (!agent) {
        await this.bot.sendMessage(chatId, `Agent "${agentName}" not found.`);
        return;
      }

      const progress = this.stateManager.getStateProgress(agent.status);
      const description = this.stateManager.getStateDescription(agent.status);

      let message = `*Agent: ${agent.name}*\n\n`;
      message += `📊 *Status:* ${agent.status}\n`;
      message += `📈 *Progress:* ${progress}%\n`;
      message += `🔒 *Risk Level:* ${agent.risk_level}\n`;
      message += `🎯 *Goal:* ${agent.goal}\n`;
      message += `📅 *Created:* ${agent.created_at.toISOString()}\n`;
      message += `🔄 *Updated:* ${agent.updated_at.toISOString()}\n\n`;
      message += `_${description}_`;

      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error) {
      await this.logger.error("Error getting agent status", error instanceof Error ? error : undefined);
      await this.bot.sendMessage(chatId, "Error retrieving agent status.");
    }
  }

  private async handleLogs(
    msg: TelegramBot.Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id.toString();
    const agentName = match?.[1]?.trim();
    const limit = match?.[2] ? parseInt(match[2]) : 10;

    if (!agentName) {
      await this.bot.sendMessage(
        chatId,
        "Usage: /logs <agent_name> [limit]\nExample: /logs weather-bot 20"
      );
      return;
    }

    try {
      const agent = await this.memoryEngine.getAgentByName(agentName);

      if (!agent) {
        await this.bot.sendMessage(chatId, `Agent "${agentName}" not found.`);
        return;
      }

      const logs = await this.logger.getAgentLogs(agent.id, undefined, undefined, limit);

      if (logs.length === 0) {
        await this.bot.sendMessage(chatId, `No logs found for "${agentName}".`);
        return;
      }

      let message = `*Logs for ${agentName}:*\n\n`;
      for (const log of logs.slice(0, 10)) {
        // Telegram message length limit
        const timestamp = new Date(log.created_at).toISOString();
        message += `[${timestamp}] ${log.level}: ${log.message}\n`;
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error) {
      await this.logger.error("Error getting logs", error instanceof Error ? error : undefined);
      await this.bot.sendMessage(chatId, "Error retrieving logs.");
    }
  }

  private async handleApprove(
    msg: TelegramBot.Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id.toString();
    const approvalId = match?.[1]?.trim();

    if (!approvalId) {
      // Get pending approvals
      const pending = await this.memoryEngine.getPendingApprovals();
      if (pending.length === 0) {
        await this.bot.sendMessage(chatId, "No pending approvals.");
        return;
      }

      let message = "*Pending Approvals:*\n\n";
      for (const approval of pending) {
        message += `ID: \`${approval.id}\`\n`;
        message += `Type: ${approval.approval_type}\n`;
        message += `Requested: ${approval.requested_at.toISOString()}\n\n`;
      }
      message += "Use: /approve <approval_id>";

      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      return;
    }

    // Approve specific approval
    try {
      const approval = await this.memoryEngine.getApproval(approvalId);

      if (!approval) {
        await this.bot.sendMessage(chatId, `Approval "${approvalId}" not found.`);
        return;
      }

      if (approval.status !== ApprovalStatus.PENDING) {
        await this.bot.sendMessage(
          chatId,
          `Approval already ${approval.status.toLowerCase()}.`
        );
        return;
      }

      await this.memoryEngine.updateApprovalStatus(
        approvalId,
        ApprovalStatus.APPROVED,
        msg.from?.username || "admin"
      );

      await this.bot.sendMessage(chatId, `✓ Approval ${approvalId} approved.`);

      // Emit event
      this.emit("approval_response", {
        approvalId,
        status: ApprovalStatus.APPROVED,
        approvedBy: msg.from?.username || "admin",
      });
    } catch (error) {
      await this.logger.error("Error approving", error instanceof Error ? error : undefined);
      await this.bot.sendMessage(chatId, "Error processing approval.");
    }
  }

  private async handleReject(
    msg: TelegramBot.Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id.toString();
    const approvalId = match?.[1]?.trim();

    if (!approvalId) {
      await this.bot.sendMessage(
        chatId,
        "Usage: /reject <approval_id>\nExample: /reject abc123"
      );
      return;
    }

    try {
      const approval = await this.memoryEngine.getApproval(approvalId);

      if (!approval) {
        await this.bot.sendMessage(chatId, `Approval "${approvalId}" not found.`);
        return;
      }

      if (approval.status !== ApprovalStatus.PENDING) {
        await this.bot.sendMessage(
          chatId,
          `Approval already ${approval.status.toLowerCase()}.`
        );
        return;
      }

      await this.memoryEngine.updateApprovalStatus(
        approvalId,
        ApprovalStatus.REJECTED,
        msg.from?.username || "admin"
      );

      await this.bot.sendMessage(chatId, `✓ Approval ${approvalId} rejected.`);

      // Emit event
      this.emit("approval_response", {
        approvalId,
        status: ApprovalStatus.REJECTED,
        approvedBy: msg.from?.username || "admin",
      });
    } catch (error) {
      await this.logger.error("Error rejecting", error instanceof Error ? error : undefined);
      await this.bot.sendMessage(chatId, "Error processing rejection.");
    }
  }

  private async handleStop(
    msg: TelegramBot.Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id.toString();
    const agentName = match?.[1]?.trim();

    if (!agentName) {
      await this.bot.sendMessage(
        chatId,
        "Usage: /stop <agent_name>\nExample: /stop weather-bot"
      );
      return;
    }

    // Emit event
    this.emit("stop_agent", { agentName, chatId });
  }

  private async handleStartAgent(
    msg: TelegramBot.Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id.toString();
    const agentName = match?.[1]?.trim();

    if (!agentName) {
      await this.bot.sendMessage(
        chatId,
        "Usage: /start_agent <agent_name>\nExample: /start_agent weather-bot"
      );
      return;
    }

    // Emit event
    this.emit("start_agent", { agentName, chatId });
  }

  private async handleDelete(
    msg: TelegramBot.Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id.toString();
    const agentName = match?.[1]?.trim();

    if (!agentName) {
      await this.bot.sendMessage(
        chatId,
        "Usage: /delete <agent_name>\nExample: /delete weather-bot"
      );
      return;
    }

    // Emit event
    this.emit("delete_agent", { agentName, chatId });
  }

  private async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
    if (!query.data || !query.message) {
      return;
    }

    const [action, approvalId] = query.data.split(":");

    if (action === "approve" || action === "reject") {
      const status =
        action === "approve" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

      await this.memoryEngine.updateApprovalStatus(
        approvalId,
        status,
        query.from.username || "admin"
      );

      await this.bot.answerCallbackQuery(query.id, {
        text: `Approval ${action}d`,
      });

      await this.bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
        }
      );

      // Emit event
      this.emit("approval_response", {
        approvalId,
        status,
        approvedBy: query.from.username || "admin",
      });
    }
  }

  // Notification Methods
  async sendApprovalRequest(
    agentName: string,
    approvalType: ApprovalType,
    approvalId: string,
    details: string
  ): Promise<string | undefined> {
    try {
      const message = `
🔔 *Approval Required*

*Agent:* ${agentName}
*Type:* ${approvalType}
*Details:* ${details}

*Approval ID:* \`${approvalId}\`

Use /approve ${approvalId} or /reject ${approvalId}
      `;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✓ Approve", callback_data: `approve:${approvalId}` },
            { text: "✗ Reject", callback_data: `reject:${approvalId}` },
          ],
        ],
      };

      const sent = await this.bot.sendMessage(this.adminChatId, message, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return sent.message_id.toString();
    } catch (error) {
      await this.logger.error("Error sending approval request", error instanceof Error ? error : undefined);
      return undefined;
    }
  }

  async sendStatusUpdate(agentName: string, status: string, details?: string): Promise<void> {
    try {
      const message = `
📊 *Status Update*

*Agent:* ${agentName}
*Status:* ${status}
${details ? `\n${details}` : ""}
      `;

      await this.bot.sendMessage(this.adminChatId, message, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      await this.logger.error("Error sending status update", error instanceof Error ? error : undefined);
    }
  }

  async sendAlert(agentName: string, alertType: string, message: string): Promise<void> {
    try {
      const alertMessage = `
🚨 *Alert: ${alertType}*

*Agent:* ${agentName}
*Message:* ${message}
      `;

      await this.bot.sendMessage(this.adminChatId, alertMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      await this.logger.error("Error sending alert", error instanceof Error ? error : undefined);
    }
  }

  async sendError(agentName: string, errorMessage: string, errorStack?: string): Promise<void> {
    try {
      const message = `
❌ *Error*

*Agent:* ${agentName}
*Message:* ${errorMessage}
${errorStack ? `\n\`\`\`\n${errorStack.slice(0, 500)}\n\`\`\`` : ""}
      `;

      await this.bot.sendMessage(this.adminChatId, message, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      await this.logger.error("Error sending error notification", error instanceof Error ? error : undefined);
    }
  }

  async sendSuccess(agentName: string, message: string): Promise<void> {
    try {
      const successMessage = `
✅ *Success*

*Agent:* ${agentName}
*Message:* ${message}
      `;

      await this.bot.sendMessage(this.adminChatId, successMessage, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      await this.logger.error("Error sending success notification", error instanceof Error ? error : undefined);
    }
  }

  // Event emitter for orchestrator
  private eventHandlers: Map<string, Function[]> = new Map();

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }
}
