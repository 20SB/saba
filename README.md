# SABA - ShelfEx Agent Builder Agent

**A meta-agent system for creating, validating, deploying, and managing AI agents**

SABA is an autonomous agent that designs, plans, secures, creates, validates, deploys, and manages other AI agents. It acts as an Agent Architect + Security Controller + Deployment Manager + Lifecycle Manager, with Telegram Bot integration for human-in-the-loop approvals.

## Features

- **9-Stage Agent Lifecycle**: Request → Planning → Security → Approval → Generation → Validation → Deployment → Monitoring → Active
- **LLM-Powered Planning**: Uses Anthropic Claude for intelligent agent architecture design
- **Security-First**: Risk classification, least privilege, approval gates for sensitive operations
- **Multi-Approval Gates**: Human-in-the-loop approvals at critical stages
- **Template-Based Generation**: Predictable, secure code generation from proven templates
- **Multi-Stage Validation**: Compilation, syntax, security, logic, and dry-run testing
- **Flexible Deployment**: Local processes or Docker containers
- **Active Monitoring**: Health checks, metrics tracking, automatic alerting
- **Automatic Recovery**: Intelligent error recovery strategies
- **Telegram Interface**: Complete admin control via Telegram Bot

## Architecture

```
Admin (Telegram)
    ↓
Telegram Bot Interface
    ↓
SABA Orchestrator
    ├── Planning Engine (LLM-powered)
    ├── Security Engine (Risk classification)
    ├── Approval Engine (Human-in-the-loop)
    ├── Agent Generator (Template-based)
    ├── Validation Engine (Multi-stage)
    ├── Deployment Engine (Local/Docker)
    ├── Monitor Engine (Health & metrics)
    ├── Memory Engine (PostgreSQL)
    └── Recovery Engine (Auto-recovery)
```

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL 15+
- Docker (for containerized deployment)
- Telegram Bot Token
- Anthropic API Key

## Quick Start

### 1. Clone and Install

```bash
cd SABA
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials:
# - ANTHROPIC_API_KEY
# - TELEGRAM_BOT_TOKEN
# - TELEGRAM_ADMIN_CHAT_ID
# - Database credentials
```

### 3. Setup Database

**Option A: Using Docker**
```bash
docker-compose up -d postgres
```

**Option B: Local PostgreSQL**
```bash
# Install PostgreSQL 15 and create database
createdb saba_db
```

**Run Migrations**
```bash
npm run migrate
```

### 4. Start SABA

**Development Mode:**
```bash
npm run dev:telegram
```

**Production Mode:**
```bash
npm run build
npm start
```

**Docker Compose (Recommended):**
```bash
docker-compose up -d
```

## Usage

### Telegram Commands

**Agent Management:**
- `/create_agent <name> <goal>` - Create a new agent
- `/agents` - List all agents
- `/status <name>` - Get agent status
- `/logs <name> [limit]` - View agent logs

**Control:**
- `/stop <name>` - Stop an agent
- `/start_agent <name>` - Start an agent
- `/delete <name>` - Delete an agent

**Approvals:**
- `/approve [id]` - Approve a pending request
- `/reject [id]` - Reject a pending request

### Creating an Agent

```
You: /create_agent weather-bot Fetch weather data using OpenWeather API

SABA:
✓ Agent creation request received
→ Creating initial plan...
→ Initial plan created (Risk: MODERATE)
🔔 Approval Required: Initial Plan

You: /approve abc123

SABA:
→ Creating detailed plan...
→ Detailed plan created (5 modules, 2 tools)
→ Security rules defined
🔔 Approval Required: Detailed Plan

You: /approve def456

SABA:
→ Generating agent code...
→ 15 files created
→ Validating agent...
→ All validation stages passed
🔔 Approval Required: Deployment

You: /approve ghi789

SABA:
→ Deploying agent...
✅ Agent deployed successfully!
→ Monitoring started
```

## Agent Creation Lifecycle

### Stage 0: Request Intake
- Capture agent name, goal, required tools/permissions
- Create agent record in database

### Stage 1: Initial Planning
- LLM generates high-level plan
- Identifies purpose, capabilities, tools, complexity
- Classifies risk level
- Requests approval if risk >= MODERATE

### Stage 2: Detailed Planning
- LLM creates detailed architecture
- Defines modules, tool integrations, memory strategy
- Plans deployment and monitoring
- Requests approval

### Stage 3: Security Definition
- Defines allowed/forbidden actions
- Sets filesystem and network access rules
- Establishes approval-required actions
- Enforces least privilege principle

### Stage 4: Approval Checkpoint
- Presents complete plan to admin
- Waits for approval via Telegram
- Aborts if rejected

### Stage 5: Agent Generation
- Generates code from templates
- Creates complete folder structure
- Writes all TypeScript, config, and Docker files

### Stage 6: Validation
- **Compilation**: TypeScript tsc check
- **Syntax**: AST validation
- **Security**: Pattern scanning
- **Logic**: Structural checks
- **Dry Run**: Full build test

### Stage 7: Deployment
- Requests deployment approval
- Deploys to target (local/Docker)
- Verifies successful start

### Stage 8: Monitoring
- Starts health monitoring
- Tracks metrics (errors, uptime, etc.)
- Sends alerts on anomalies
- Auto-recovery on failures

### Stage 9: Active
- Agent is operational
- Continuous monitoring
- Admin control via Telegram

## Risk Levels

- **SAFE (0)**: No sensitive operations, no approval needed
- **MODERATE (1)**: Some filesystem/network access, approval for deployment
- **SENSITIVE (2)**: Credentials, multiple permissions, approval required
- **CRITICAL (3)**: High-risk operations, mandatory approval at all stages

## Security Features

- **Default Deny**: Whitelist-based permissions
- **Forbidden Patterns**: Blocks eval, exec, child_process, etc.
- **Path Validation**: Prevents directory traversal
- **Credential Scanning**: Detects hardcoded secrets
- **Approval Gates**: Human review for sensitive operations
- **Audit Logging**: Complete action history

## Database Schema

- **agents**: Agent metadata and state
- **plans**: Initial and detailed plans
- **approvals**: Approval requests and responses
- **logs**: System and agent logs
- **security_rules**: Security configurations per agent

## File Structure

```
SABA/
├── src/
│   ├── database/
│   │   ├── connection.ts
│   │   ├── migrate.ts
│   │   └── migrations/
│   ├── engines/
│   │   ├── memory.engine.ts
│   │   ├── logger.ts
│   │   ├── state.manager.ts
│   │   ├── planning.engine.ts
│   │   ├── security.engine.ts
│   │   ├── approval.engine.ts
│   │   ├── agent.generator.ts
│   │   ├── validation.engine.ts
│   │   ├── deployment.engine.ts
│   │   ├── monitor.engine.ts
│   │   └── recovery.engine.ts
│   ├── interfaces/
│   │   └── telegram.interface.ts
│   ├── templates/
│   │   ├── brain.template.ts
│   │   ├── config.template.ts
│   │   ├── package.template.json
│   │   └── ...
│   ├── utils/
│   │   ├── validator.ts
│   │   ├── docker.utils.ts
│   │   └── file.utils.ts
│   ├── types.ts
│   ├── config.ts
│   └── index.ts
├── agents/          # Generated agents
├── logs/            # SABA logs
├── memory/          # Persistent state
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Development

**Build:**
```bash
npm run build
```

**Run Tests:**
```bash
npm test
```

**Lint:**
```bash
npm run lint
```

**Watch Mode:**
```bash
npm run dev
```

## Monitoring

SABA provides comprehensive monitoring:

- **Health Checks**: Periodic status verification
- **Metrics Tracking**: Errors, uptime, resource usage
- **Alert Conditions**: Configurable thresholds
- **Auto-Recovery**: Automatic restart on failures
- **Telegram Alerts**: Real-time notifications

## Recovery Strategies

- **Generation Failure**: Retry with modified prompt
- **Validation Failure**: Code repair and regeneration
- **Deployment Failure**: Rollback and retry
- **Runtime Crash**: Automatic restart (max 3 attempts)

## Configuration

Key environment variables:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=saba
DB_PASSWORD=your_password
DB_NAME=saba_db

# Anthropic
ANTHROPIC_API_KEY=your_api_key

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_chat_id

# Paths
AGENTS_BASE_PATH=./agents
LOGS_PATH=./logs
MEMORY_PATH=./memory

# Monitoring
HEALTH_CHECK_INTERVAL_MS=60000
ALERT_ERROR_THRESHOLD=10

# Security
MAX_RETRY_ATTEMPTS=3
APPROVAL_TIMEOUT_MS=3600000
```

## Troubleshooting

**Database Connection Failed:**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
psql -h localhost -U saba -d saba_db
```

**Telegram Bot Not Responding:**
- Verify TELEGRAM_BOT_TOKEN is correct
- Check bot has been started with /start
- Confirm TELEGRAM_ADMIN_CHAT_ID matches your chat

**Agent Generation Failed:**
- Check Anthropic API key is valid
- Review logs: `tail -f logs/saba.log`
- Check disk space for agent output

**Deployment Failed:**
- Ensure Docker daemon is running (for Docker deployments)
- Check port conflicts for local deployments
- Review agent validation errors

## Contributing

SABA is built with extensibility in mind:

- **New Engines**: Add to `src/engines/`
- **New Templates**: Add to `src/templates/`
- **New Tools**: Extend template system
- **New Deployment Targets**: Extend DeploymentEngine

## License

MIT

## Credits

Built with:
- TypeScript
- Node.js
- PostgreSQL
- Anthropic Claude
- Telegram Bot API
- Docker

---

**Generated by SABA Team**
