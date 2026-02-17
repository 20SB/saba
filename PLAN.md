ShelfEx Agent Builder Agent (SABA)

1. Overview
    The ShelfEx Agent Builder Agent (SABA) is a supervisory AI agent responsible for designing, planning, securing, creating, validating, deploying, and managing other AI agents.

    It acts as an Agent Architect + Security Controller + Deployment Manager + Lifecycle Manager.

    SABA communicates with the admin via Telegram Bot for approvals, notifications, clarifications, and operational updates.

    Implementation Language Requirement:
    All components must be implemented in TypeScript, running on Node.js runtime.

2. Core Objectives
    SABA must be able to:
        Understand agent creation requests
        Perform multi-level planning
        Enforce strict security and compliance rules
        Build production-grade agents
        Validate agents before deployment
        Deploy agents safely
        Monitor agent performance
        Update agents when needed
        Maintain memory of all agents and decisions
        Request human approval when required
        Never perform dangerous actions without approval

3. System Architecture
    Admin (Telegram)
        │
        ▼
    Telegram Bot Interface
        │
        ▼
    ShelfEx Agent Builder Agent (SABA)
        │
        ├── Planning Engine
        ├── Security Engine
        ├── Agent Generator Engine
        ├── Validation Engine
        ├── Deployment Engine
        ├── Monitoring Engine
        ├── Memory Engine
        ├── Approval Engine
        └── Recovery Engine
                │
                ▼
            Generated Agents

4. Agent Creation Lifecycle
    The agent creation lifecycle contains multiple stages.

    Stage 0: Request Intake
    Input sources:
        Telegram Admin Request
        API Request
        File Input
        Manual Trigger

    SABA extracts:
        agent_name
        agent_goal
        agent_type
        required_tools
        required_permissions
        deployment_target
        risk_level

    Stage 1: Initial Planning (High-Level Planning)
    Goal: Understand what needs to be built.

    Output:
        agent_purpose
        core_capabilities
        required_tools
        estimated_complexity
        risk_level
        required_permissions
        human_approval_required


    Telegram notification sent:
    Initial plan ready. Approve to continue?

    Stage 2: Detailed Planning (Architecture Planning)
    Creates detailed technical plan.

    Output:
        architecture_design
        module_structure
        tools_integration_plan
        memory_requirements
        security_requirements
        failure_handling_strategy
        deployment_strategy
        monitoring_strategy


    Saved to:
    memory/plans/{agent_name}_detailed_plan.json

    Telegram notification sent for approval.

    Stage 3: Security Rules Definition
    Security Engine defines:
        allowed_actions
        forbidden_actions
        tool_permissions
        filesystem_access_rules
        network_access_rules
        credential_access_rules
        approval_required_actions


    Security Levels:
        LEVEL 0: Safe
        LEVEL 1: Moderate
        LEVEL 2: Sensitive
        LEVEL 3: Critical


    Critical actions require mandatory human approval.

    Stage 4: Approval Checkpoint
    Approval Engine verifies:
    if risk_level >= moderate:
        require approval


    Telegram message:
        Approve agent creation?
        Approve / Reject / Modify


    Wait for admin response.

    Stage 5: Agent Generation
    Agent Generator Engine creates:
        agent folder structure
        agent brain file
        tool connectors
        memory module
        config file
        security rules file
        monitor module
        telegram integration


    Folder structure:
    agents/{agent_name}/
        brain.ts
        config.json
        tools/
        memory/
        security/
        monitor/
        logs/

    Stage 6: Validation
    Validation Engine performs:
        TypeScript compilation validation
        Syntax validation
        Logic validation
        Tool connection validation
        Security validation
        Dry run simulation
        Failure testing

    Output:
    validation_report.json

    If validation fails → Recovery Engine attempts repair.

    Stage 7: Deployment
    Deployment Engine deploys agent to:
        Local runtime
        Docker container
        Cloud
        VM
        Server
        Deployment metadata saved in memory.

    Stage 8: Monitoring
    Monitoring Engine tracks:
        agent_health
        cpu_usage
        memory_usage
        error_rate
        activity_logs
        security_events

    If anomaly detected → Telegram alert sent.

    Stage 9: Lifecycle Management
    Supports:
        agent_update
        agent_pause
        agent_resume
        agent_delete
        agent_rebuild
        agent_upgrade

5. Telegram Integration
    Telegram Bot is the primary admin interface.

    Features:
        Send approval requests
        Send status updates
        Send error alerts
        Send completion notifications
        Accept commands
        Accept modification instructions

    Supported commands:
        /agents
        /create_agent
        /stop_agent
        /start_agent
        /delete_agent
        /status
        /approve
        /reject
        /modify
        /logs

6. Memory System
    Memory stores:
        agents metadata
        plans
        security rules
        approvals
        deployment logs
        errors
        decisions
        agent performance data


    Memory types:
        Short-term memory
        Long-term memory
        Persistent storage
        Vector memory


    Storage options:
        Postgres
        JSON files
        Vector database
        Redis

7. Approval Engine
    Approval required for:
        filesystem access
        network access
        external API access
        credential access
        deployment
        agent modification
        agent deletion


    Approval flow:
        Send approval request
        Wait for admin response
        Execute or Abort based on response

8. Security Engine
    Security principles:
    Least privilege access

    Agents cannot:
        Access credentials without permission
        Execute system commands without approval
        Modify other agents
        Modify core system
        Access restricted files

    All actions must be logged.

9. Recovery Engine
    Handles failures:
        generation failure
        deployment failure
        runtime crash
        security violation
        tool failure

    Actions:
        retry
        repair
        rollback
        notify admin
        disable agent

10. Logging System
    Log everything:
        agent creation
        agent execution
        errors
        security events
        approvals
        decisions
        tool usage

    Stored in:
    logs/
    database

11. Admin Interaction Workflow
    Example flow:

    Admin sends via Telegram:
    Create agent that monitors server and restarts if down

    SABA workflow:
        Stage 1 complete → Ask approval
        Stage 2 complete → Ask approval
        Stage 3 complete → Ask approval
        Stage 5 complete → Notify creation
        Stage 7 complete → Notify deployment
        Stage 8 active → Send monitoring updates

12. Failure Handling Workflow
    If error occurs:
        Detect error
        Classify error
        Attempt repair
        If repair fails → Notify admin
        Wait for admin instruction

13. State Machine
    Agent states:
        REQUESTED
        PLANNING_INITIAL
        PLANNING_DETAILED
        SECURITY_DEFINED
        WAITING_APPROVAL
        GENERATING
        VALIDATING
        DEPLOYING
        ACTIVE
        FAILED
        PAUSED
        DELETED

14. Required Modules (TypeScript)
    SABA must implement the following modules in TypeScript:
        planning.engine.ts
        security.engine.ts
        approval.engine.ts
        agent.generator.ts
        validation.engine.ts
        deployment.engine.ts
        monitor.engine.ts
        memory.engine.ts
        recovery.engine.ts
        telegram.interface.ts
        state.manager.ts
        logger.ts
        config.ts

15. Database Schema
    agents table
        id
        name
        goal
        status
        risk_level
        created_at
        updated_at

    plans table
        id
        agent_id
        plan_data
        created_at

    approvals table
        id
        agent_id
        approval_type
        status
        approved_by
        created_at

    logs table
        id
        agent_id
        log_type
        message
        created_at

16. Safety Guarantees
    System must ensure:
        No unsafe execution
        No unauthorized access
        No uncontrolled agent creation
        No silent failures
        No silent security violations

17. Future Enhancements
    Support:
        self-improving agents
        multi-agent collaboration
        agent templates
        agent marketplace
        auto-optimization
        distributed agents

18. Completion Definition
    SABA is complete when it can:
        Accept agent creation request via Telegram
        Plan agent
        Request approval
        Generate agent
        Validate agent
        Deploy agent
        Monitor agent
        Maintain memory
        Notify admin

19. Technology Stack (Mandatory)
    Core runtime:
        Node.js
        TypeScript

    Database:
        PostgreSQL

    Agent runtime:
        Node.js (TypeScript)

    Containerization:
        Docker

    Telegram integration:
        Telegram Bot API

    Optional:
        Redis
        Vector DB

20. Execution Priority Order
    Build in the following order:
        1. memory.engine.ts
        2. state.manager.ts
        3. logger.ts
        4. telegram.interface.ts
        5. planning.engine.ts
        6. approval.engine.ts
        7. security.engine.ts
        8. agent.generator.ts
        9. validation.engine.ts
        10. deployment.engine.ts
        11. monitor.engine.ts
        12. recovery.engine.ts
