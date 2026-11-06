"use client";

import { useAuth } from "@/hooks/use-auth";
import { AdminInvoices } from "@/components/admin-invoices";
import AdminOvertimeRequests from "@/components/admin-overtime-requests";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Clock } from "lucide-react";

export function AccountingDashboard() {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a5f] via-[#264d73] to-[#1a3352] p-6 sm:p-8 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
                <div className="relative z-10">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Panel de Contabilidad</h1>
                    <p className="text-white/60 mt-1 text-sm sm:text-base">Gestiona facturas y solicitudes de horas extra.</p>
                </div>
            </div>

            <Tabs defaultValue="invoices" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 h-auto border border-slate-200 rounded-xl">
                    <TabsTrigger 
                        value="invoices"
                        className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap
                          data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white data-[state=active]:shadow-lg
                          data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600 data-[state=inactive]:border border-slate-200 data-[state=inactive]:hover:bg-slate-50
                          transition-all duration-200"
                    >
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span>Facturas</span>
                    </TabsTrigger>
                    
                    <TabsTrigger 
                        value="overtime"
                        className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap
                          data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white data-[state=active]:shadow-lg
                          data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600 data-[state=inactive]:border border-slate-200 data-[state=inactive]:hover:bg-slate-50
                          transition-all duration-200"
                    >
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>Horas Extras</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="invoices">
                    <AdminInvoices />
                </TabsContent>

                <TabsContent value="overtime">
                    <AdminOvertimeRequests />
                </TabsContent>
            </Tabs>
        </div>
    );
}
