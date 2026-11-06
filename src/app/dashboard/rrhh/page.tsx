"use client";

import { BocoRrhhDashboard } from "@/components/boco-rrhh-dashboard";
import { RoleGuard } from "@/components/role-guard";

export default function RrhhPage() {
  return (
    <RoleGuard roles={["rrhh"]}>
      <BocoRrhhDashboard />
    </RoleGuard>
  );
}
