// Enums
export enum AgentState {
  REQUESTED = "REQUESTED",
  PLANNING_INITIAL = "PLANNING_INITIAL",
  PLANNING_DETAILED = "PLANNING_DETAILED",
  SECURITY_DEFINED = "SECURITY_DEFINED",
  WAITING_APPROVAL = "WAITING_APPROVAL",
  GENERATING = "GENERATING",
  VALIDATING = "VALIDATING",
  DEPLOYING = "DEPLOYING",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  FAILED = "FAILED",
  DELETED = "DELETED",
}

export enum RiskLevel {
  SAFE = "SAFE",
  MODERATE = "MODERATE",
  SENSITIVE = "SENSITIVE",
  CRITICAL = "CRITICAL",
}

export enum ApprovalType {
  INITIAL_PLAN = "INITIAL_PLAN",
  DETAILED_PLAN = "DETAILED_PLAN",
  SECURITY_RULES = "SECURITY_RULES",
  DEPLOYMENT = "DEPLOYMENT",
  MODIFICATION = "MODIFICATION",
  DELETION = "DELETION",
}

export enum ApprovalStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  TIMEOUT = "TIMEOUT",
}

export enum DeploymentTarget {
  LOCAL = "local",
  DOCKER = "docker",
  CLOUD = "cloud",
  VM = "vm",
  SERVER = "server",
}

export enum LogType {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  SECURITY = "SECURITY",
  APPROVAL = "APPROVAL",
  STATE_TRANSITION = "STATE_TRANSITION",
  GENERATION = "GENERATION",
  VALIDATION = "VALIDATION",
  DEPLOYMENT = "DEPLOYMENT",
  MONITORING = "MONITORING",
}

export enum LogLevel {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
}

// Database Models
export interface Agent {
  id: string;
  name: string;
  goal: string;
  status: AgentState;
  risk_level: RiskLevel;
  deployment_target: DeploymentTarget;
  agent_type?: string;
  required_tools?: string[];
  required_permissions?: string[];
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Plan {
  id: string;
  agent_id: string;
  plan_type: string;
  plan_data: Record<string, any>;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface Approval {
  id: string;
  agent_id: string;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  telegram_message_id?: string;
  request_data?: Record<string, any>;
  response_data?: Record<string, any>;
  approved_by?: string;
  approval_notes?: string;
  requested_at: Date;
  responded_at?: Date;
  created_at: Date;
}

export interface LogEntry {
  id: string;
  agent_id?: string;
  log_type: LogType;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  error_stack?: string;
  created_at: Date;
}

export interface SecurityRule {
  id: string;
  agent_id: string;
  rule_type: string;
  rule_data: Record<string, any>;
  version: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

// Request Models
export interface AgentRequest {
  name: string;
  goal: string;
  agent_type?: string;
  required_tools?: string[];
  required_permissions?: string[];
  deployment_target?: DeploymentTarget;
}

// Planning Models
export interface InitialPlan {
  agent_purpose: string;
  core_capabilities: string[];
  required_tools: string[];
  estimated_complexity: "low" | "medium" | "high";
  risk_level: RiskLevel;
  required_permissions: string[];
  human_approval_required: boolean;
  reasoning: string;
}

export interface DetailedPlan {
  agent_name: string;
  architecture_design: string;
  module_structure: ModuleDefinition[];
  tools_integration_plan: ToolIntegration[];
  memory_requirements: MemoryRequirements;
  security_requirements: SecurityRequirements;
  failure_handling_strategy: FailureHandling;
  deployment_strategy: DeploymentStrategy;
  monitoring_strategy: MonitoringStrategy;
}

export interface ModuleDefinition {
  name: string;
  purpose: string;
  dependencies: string[];
  exports: string[];
}

export interface ToolIntegration {
  tool_name: string;
  purpose: string;
  api_requirements?: string[];
  credentials_required?: boolean;
  network_access_required?: boolean;
}

export interface MemoryRequirements {
  persistent_storage: boolean;
  memory_type: "short-term" | "long-term" | "both";
  storage_backend: "postgres" | "json" | "redis" | "vector-db";
  estimated_storage_size: string;
}

export interface SecurityRequirements {
  allowed_actions: string[];
  forbidden_actions: string[];
  tool_permissions: Record<string, string[]>;
  filesystem_access_rules: FilesystemAccessRules;
  network_access_rules: NetworkAccessRules;
  credential_access_rules: CredentialAccessRules;
  approval_required_actions: string[];
}

export interface FilesystemAccessRules {
  allowed_paths: string[];
  forbidden_paths: string[];
  read_only_paths: string[];
  write_allowed_paths: string[];
}

export interface NetworkAccessRules {
  allowed_domains: string[];
  forbidden_domains: string[];
  allowed_ports: number[];
  require_https: boolean;
}

export interface CredentialAccessRules {
  allowed_credential_types: string[];
  credential_storage: "env" | "vault" | "encrypted-file";
  require_approval_for_access: boolean;
}

export interface FailureHandling {
  retry_strategy: "immediate" | "exponential-backoff" | "manual";
  max_retries: number;
  error_notification: boolean;
  automatic_recovery: boolean;
}

export interface DeploymentStrategy {
  target: DeploymentTarget;
  containerized: boolean;
  resource_limits?: ResourceLimits;
  environment_variables: Record<string, string>;
  health_check_endpoint?: string;
}

export interface ResourceLimits {
  cpu_limit?: string;
  memory_limit?: string;
  disk_limit?: string;
}

export interface MonitoringStrategy {
  health_check_interval_ms: number;
  metrics_to_track: string[];
  alert_conditions: AlertCondition[];
  log_level: LogLevel;
}

export interface AlertCondition {
  metric: string;
  threshold: number;
  comparison: ">" | "<" | "==" | "!=" | ">=" | "<=";
  action: "notify" | "restart" | "pause" | "escalate";
}

// Generation Models
export interface GeneratedAgent {
  agent_name: string;
  files: GeneratedFile[];
  folder_structure: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: "TS" | "JSON" | "SQL" | "MD" | "DOCKERFILE" | "YAML";
}

// Validation Models
export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stages_completed: string[];
  timestamp: Date;
}

export interface ValidationError {
  stage: string;
  message: string;
  file?: string;
  line?: number;
  severity: "error" | "critical";
}

export interface ValidationWarning {
  stage: string;
  message: string;
  file?: string;
  line?: number;
}

// Deployment Models
export interface DeploymentResult {
  success: boolean;
  deployment_id?: string;
  process_id?: number;
  container_id?: string;
  deployment_url?: string;
  error_message?: string;
  timestamp: Date;
}

// Monitoring Models
export interface HealthStatus {
  agent_id: string;
  agent_name: string;
  status: "healthy" | "unhealthy" | "degraded" | "unknown";
  uptime_ms: number;
  last_check: Date;
  metrics: HealthMetrics;
  issues: string[];
}

export interface HealthMetrics {
  cpu_usage_percent?: number;
  memory_usage_mb?: number;
  error_count: number;
  request_count?: number;
  response_time_ms?: number;
  [key: string]: number | undefined;
}

// Recovery Models
export interface RecoveryAction {
  agent_id: string;
  failure_type: string;
  recovery_strategy: string;
  attempted_at: Date;
  success: boolean;
  details: string;
}
