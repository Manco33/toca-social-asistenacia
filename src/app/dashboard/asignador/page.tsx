"use client";

import { BocoAsignadorDashboard } from "@/components/boco-asignador-dashboard";
import { RoleGuard } from "@/components/role-guard";

export default function AsignadorPage() {
  return (
    <RoleGuard roles={["asignador"]}>
      <BocoAsignadorDashboard />
    </RoleGuard>
  );
}
