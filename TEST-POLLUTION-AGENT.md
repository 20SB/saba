# Testing SABA: Create a Pollution Tracking Agent

## Test Objective
Create an agent that tracks air quality and pollution levels for any geographic area using real-time data from pollution monitoring APIs.

## Prerequisites

### 1. Start Docker Desktop
```bash
# Open Docker Desktop application
# Wait for Docker to be fully running (icon turns green)
```

### 2. Start PostgreSQL Database
```bash
cd C:\work_area\codes\agent\SABA
docker-compose up -d postgres

# Wait 10 seconds for database to initialize
timeout 10

# Verify database is running
docker-compose ps postgres
```

### 3. Run Database Migrations
```bash
npm run migrate
```

### 4. Verify .env Configuration
Ensure `.env` file has:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=saba
DB_PASSWORD=saba_password
DB_NAME=saba_db

# Anthropic API (REQUIRED)
ANTHROPIC_API_KEY=sk-ant-...  # Your actual API key

# Telegram Bot (REQUIRED)
TELEGRAM_BOT_TOKEN=1234567890:ABC...  # Your bot token
TELEGRAM_ADMIN_CHAT_ID=123456789  # Your Telegram user ID
```

## Test Execution

### Step 1: Start SABA
```bash
cd C:\work_area\codes\agent\SABA
npm run dev:telegram
```

Expected output:
```
✓ SABA is running
✓ Telegram bot is active
✓ Database connected

Ready to create agents!
```

### Step 2: Send Telegram Command

Open Telegram and send to your SABA bot:
```
/create_agent pollution-tracker Track air quality and pollution levels for any location using AQI data
```

### Step 3: Monitor SABA Workflow

Watch the console output as SABA goes through the 9-stage lifecycle:

**Stage 0: Request Intake**
```
Creating new agent: pollution-tracker
Agent ID: <uuid>
```

**Stage 1: Initial Planning (15-20 seconds)**
```
State transition: REQUESTED → PLANNING_INITIAL
Creating initial plan for agent: pollution-tracker
Initial plan created: <LLM-generated plan>
Risk level: SAFE or MODERATE
```

**Stage 2: Detailed Planning (60-90 seconds)**
```
State transition: PLANNING_INITIAL → PLANNING_DETAILED
Creating detailed plan for agent: pollution-tracker
Detailed plan created with X modules
```

**Stage 3: Security Definition**
```
State transition: PLANNING_DETAILED → SECURITY_DEFINED
Defining security rules for agent: pollution-tracker
Security rules defined: Y allowed actions, Z forbidden actions
```

**Stage 4: Approval Request**
```
State transition: SECURITY_DEFINED → WAITING_APPROVAL
Requesting DETAILED_PLAN approval for pollution-tracker
```

You'll receive a Telegram message:
```
🔔 Approval Required

Agent: pollution-tracker
Type: DETAILED_PLAN

Details:
- Architecture: ...
- Modules: X modules
- Tools: Y integrations
...

[✓ Approve] [✗ Reject]
```

**Action Required:** Click **✓ Approve** or send:
```
/approve <approval_id>
```

**Stage 5: Agent Generation (5-10 seconds)**
```
State transition: WAITING_APPROVAL → GENERATING
Generating agent code
Agent code generated: X files created
```

**Stage 6: Validation (30-60 seconds)**
```
State transition: GENERATING → VALIDATING
Validating generated agent
Stage 1: TypeScript compilation check
Stage 2: Syntax validation
Stage 3: Security compliance check
Stage 4: Logic validation
Stage 5: Dry run test
Validation complete: PASSED
```

**Stage 7: Deployment Approval**
```
State transition: VALIDATING → DEPLOYING
Requesting DEPLOYMENT approval
```

You'll receive another Telegram approval request.

**Action Required:** Click **✓ Approve** or send:
```
/approve <approval_id>
```

**Stage 8: Deployment (10-20 seconds)**
```
Deploying agent to local environment
Installing dependencies...
Building agent...
Starting agent...
Deployment successful!
```

**Stage 9: Monitoring Active**
```
State transition: DEPLOYING → ACTIVE
Starting monitoring for pollution-tracker
Agent is now operational!
```

### Step 4: Verify Agent Creation

**Check Generated Files:**
```bash
cd C:\work_area\codes\agent\SABA
ls -la agents/pollution-tracker/

# Expected structure:
# agents/pollution-tracker/
# ├── src/
# │   ├── brain.ts
# │   ├── config.ts
# │   ├── logger.ts
# │   ├── tools/
# │   ├── memory/
# │   ├── security/
# │   └── monitor/
# ├── package.json
# ├── tsconfig.json
# ├── Dockerfile
# └── README.md
```

**Check Agent Status via Telegram:**
```
/status pollution-tracker
```

Expected response:
```
Agent: pollution-tracker
Status: ACTIVE
Progress: 100%
Risk Level: SAFE/MODERATE
Goal: Track air quality and pollution levels...
Created: 2026-02-17T...
```

**View Agent Logs:**
```
/logs pollution-tracker 10
```

**List All Agents:**
```
/agents
```

### Step 5: Verify Agent is Running

**Check Process:**
```bash
# View running agent processes
ps aux | grep pollution-tracker

# Check agent logs
tail -f agents/pollution-tracker/logs/pollution-tracker.log
```

**Check Database:**
```bash
# Connect to database
docker exec -it saba-postgres psql -U saba -d saba_db

# Query agent
SELECT id, name, status, risk_level, created_at FROM agents WHERE name = 'pollution-tracker';

# View plans
SELECT plan_type, created_at FROM plans WHERE agent_id = (SELECT id FROM agents WHERE name = 'pollution-tracker');

# View approvals
SELECT approval_type, status, approved_by FROM approvals WHERE agent_id = (SELECT id FROM agents WHERE name = 'pollution-tracker');

\q
```

## Expected Agent Capabilities

The generated pollution-tracker agent should have:

### Tools/Integrations
- **Air Quality API** (e.g., OpenAQ, AirVisual, or IQAir)
- **Geocoding Service** (to convert location names to coordinates)
- **Data Storage** (Redis or PostgreSQL for caching)
- **Alert System** (for pollution threshold notifications)

### Modules
- **Brain** - Main orchestration logic
- **Config** - Environment configuration
- **Logger** - Structured logging
- **Memory Manager** - Data persistence
- **Security Enforcer** - Access control
- **Monitor Service** - Health tracking
- **Tool Connectors** - API integrations

### Security Rules
- ✅ Allowed: Read config, log events, call pollution APIs
- ❌ Forbidden: Execute system commands, modify system files
- ⚠️ Requires Approval: Network access to APIs

## Test Variations

### Test 1: Successful Creation
```
/create_agent pollution-tracker Track air quality and pollution levels for any location using AQI data
```
Expected: Full workflow completion, ACTIVE status

### Test 2: Duplicate Name
```
/create_agent pollution-tracker Another description
```
Expected: Error message about duplicate name

### Test 3: Rejection
```
/create_agent test-agent Test description
# When approval comes, click Reject
```
Expected: Transition to FAILED state

### Test 4: Deletion During Approval
```
/create_agent temp-agent Temporary test
# Wait for approval request
/delete temp-agent
```
Expected: Successful deletion from WAITING_APPROVAL state

## Monitoring the Test

**Watch SABA Logs:**
```bash
# Terminal 1: SABA console output
npm run dev:telegram

# Terminal 2: Error logs
tail -f logs/errors.log

# Terminal 3: System logs
tail -f logs/saba.log
```

## Success Criteria

✅ Agent creation request accepted
✅ Initial plan generated (15-20s)
✅ Detailed plan generated (60-90s)
✅ Security rules defined
✅ Approval notifications sent to Telegram
✅ Approvals processed correctly
✅ Agent code generated with valid TypeScript
✅ All validation stages pass
✅ Agent deploys successfully
✅ Agent process is running
✅ Monitoring is active
✅ No errors in logs
✅ Generated files are valid
✅ Agent responds to status commands

## Troubleshooting

### Issue: Telegram bot not responding
**Fix:** Verify bot token and chat ID in `.env`

### Issue: Database connection failed
**Fix:**
```bash
docker-compose restart postgres
npm run migrate
```

### Issue: Anthropic API errors
**Fix:** Check API key is valid and has credits

### Issue: Validation failures
**Fix:** Check `logs/errors.log` for details

### Issue: Agent won't start
**Fix:**
```bash
cd agents/pollution-tracker
npm install
npm run build
npm start
```

## Cleanup

**Stop Agent:**
```
/stop pollution-tracker
```

**Delete Agent:**
```
/delete pollution-tracker
```

**Stop SABA:**
```
Ctrl+C in terminal
```

**Stop Database:**
```bash
docker-compose down
```

## Expected Timeline

| Stage | Duration | Cumulative |
|-------|----------|------------|
| Request Intake | < 1s | ~1s |
| Initial Planning | 15-20s | ~20s |
| Detailed Planning | 60-90s | ~110s |
| Security Definition | < 1s | ~110s |
| Approval (manual) | Variable | Variable |
| Generation | 5-10s | ~120s |
| Validation | 30-60s | ~180s |
| Approval (manual) | Variable | Variable |
| Deployment | 10-20s | ~200s |
| **Total (automated)** | **~3-4 minutes** | |

## Next Steps

After successful creation:
1. Inspect generated code
2. Customize agent behavior
3. Add actual API credentials
4. Test agent functionality
5. Deploy to production environment

---

**Test Documentation**
**Date:** 2026-02-17
**Agent:** pollution-tracker
**Expected Outcome:** Fully functional pollution monitoring agent
