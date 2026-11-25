export type AuditLogCategory = "AUTH" | "ADMIN" | "PAYMENT" | "SHIPPING" | "SYSTEM";

export type AuditLogSeverity = "info" | "warning" | "critical";

export type AuditLogStatus = "success" | "failure";

export interface IAuditLogActor {
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface IAuditLogResource {
  type: string;
  id?: string;
  label?: string;
}

export interface IAuditLogChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface IAuditLogContext {
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  requestId?: string;
}

export interface IAuditLog {
  _id?: string;
  id?: string;
  category: AuditLogCategory;
  action: string;
  severity: AuditLogSeverity;
  status: AuditLogStatus;
  actor: IAuditLogActor;
  resource: IAuditLogResource;
  changes?: IAuditLogChanges;
  context: IAuditLogContext;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string | Date;
}

export interface IAuditLogStats {
  totalLast24h: number;
  failedLoginsLast24h: number;
  criticalChangesLast24h: number;
  paymentAndShippingFailuresLast24h: number;
}

export type ServiceHealthStatus = "healthy" | "degraded" | "down" | "not_configured";

export type GatewayHealthStatus = "operational" | "degraded" | "misconfigured" | "disabled";

export interface IGatewayHealthItem {
  gateway: "payu" | "ccavenue" | "snapmint" | "upi";
  label: string;
  enabled: boolean;
  configured: boolean;
  mode: string | null;
  health: GatewayHealthStatus;
  last24h: {
    total: number;
    captured: number;
    failed: number;
    pending: number;
  };
  lastEventAt: string | null;
}

export interface ISystemHealthReport {
  checkedAt: string;
  overallStatus: "healthy" | "degraded" | "critical";
  api: {
    status: "healthy";
    uptimeSeconds: number;
    memoryUsedMb: number;
    nodeVersion: string;
    environment: string;
  };
  database: {
    status: ServiceHealthStatus;
    readyState: number;
    latencyMs: number | null;
  };
  redis: {
    status: "healthy" | "fallback_memory" | "down";
    configured: boolean;
    latencyMs: number | null;
  };
  meilisearch: {
    status: ServiceHealthStatus;
    latencyMs: number | null;
  };
  paymentGateways: IGatewayHealthItem[];
  shippingProviders: Array<{
    provider: "shiprocket" | "delhivery" | "xpressbees";
    label: string;
    configured: boolean;
  }>;
  recentSystemErrors24h: number;
}
