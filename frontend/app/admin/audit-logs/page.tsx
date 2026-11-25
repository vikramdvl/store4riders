import { AdminAuditLogsModule } from "@/modules/admin-logs";

export const metadata = {
  title: "Audit & Security Logs | Admin | Store4Riders",
  description: "Inspect immutable audit trails, security logins, payment webhooks, and shipping events.",
};

export default function AdminAuditLogsPage() {
  return <AdminAuditLogsModule />;
}
