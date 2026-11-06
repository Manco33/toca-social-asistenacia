"use client";

import { BocoSuperAdminDashboard } from "@/components/boco-superadmin-dashboard";
import { RoleGuard } from "@/components/role-guard";

export default function SuperAdminPage() {
  return (
    <RoleGuard roles={["superadmin"]}>
      <BocoSuperAdminDashboard />
    </RoleGuard>
  );
}

