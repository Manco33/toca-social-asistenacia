"use client";

import { useState, useEffect } from "react";
import { getInvoices, updateInvoiceStatus, getInvoiceSignedUrl } from "@/app/invoice-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Invoice } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Check, X, FileText, ExternalLink, Download, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function AdminInvoices() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selectedInvoiceUrl, setSelectedInvoiceUrl] = useState<string | null>(null);
    const [editingDescription, setEditingDescription] = useState<string>("");
    const [editingNit, setEditingNit] = useState<string>("");
    const [editingProveedor, setEditingProveedor] = useState<string>("");
    const [editingMonto, setEditingMonto] = useState<string>("");
    const [editingFecha, setEditingFecha] = useState<string>("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [filterMonth, setFilterMonth] = useState<string>("");
    const [filterUser, setFilterUser] = useState<string>("");
    const { toast } = useToast();

    const filteredInvoices = invoices.filter((inv: any) => {
        const dateStr = inv.fecha_factura || inv.created_at?.split('T')[0] || "";
        const matchesMonth = filterMonth ? dateStr.startsWith(filterMonth) : true;

        const userName = (inv.empleados?.nombre || inv.usuario_id || "").toLowerCase();
        const matchesUser = filterUser ? userName.includes(filterUser.toLowerCase()) : true;

        return matchesMonth && matchesUser;
    });

    const exportToExcel = () => {
        const data = filteredInvoices.map((inv: any) => {
            let extraData: any = {};
            try {
                extraData = typeof inv.datos_extraidos === 'string'
                    ? JSON.parse(inv.datos_extraidos || '{}')
                    : (inv.datos_extraidos || {});
            } catch (e) {
                // Ignore parse errors for badly formatted legacy data
            }

            return {
                'Fecha': inv.fecha_factura || inv.created_at?.split('T')[0],
                'Proveedor': inv.proveedor,
                'Descripción': inv.descripcion,
                'Monto (Q)': inv.monto ? Number(inv.monto).toFixed(2) : "0.00",
                'Usuario': inv.empleados?.nombre || inv.usuario_id,
                'Estado': (inv.estado || "").toUpperCase(),
                'NIT': extraData?.nit || "—",
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Facturas");
        XLSX.writeFile(workbook, `facturas-${filterMonth || 'todas'}.xlsx`);
    };

    const loadInvoices = async () => {
        try {
            const data = await getInvoices(); // No ID = all
            setInvoices(data as Invoice[]);
        } catch (error) {
            console.error("Error loading invoices:", error);
        }
    };

    useEffect(() => {
        loadInvoices();
    }, []);

    const handleStatusChange = async (id: string, status: string, note: string = "") => {
        try {
            await updateInvoiceStatus(Number(id), status, note, {
                descripcion: editingDescription,
                proveedor: editingProveedor,
                nit: editingNit,
                monto: parseFloat(editingMonto),
                fecha: editingFecha
            });
            toast({ title: "Estado actualizado", description: `La factura ha sido ${status}` });
            setIsDialogOpen(false); // Close dialog on success
            loadInvoices();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const handleViewInvoice = async (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setEditingDescription(invoice.descripcion || "");
        setEditingProveedor(invoice.proveedor || "");
        setEditingMonto(invoice.monto?.toString() || "");
        setEditingFecha(invoice.fecha_factura || "");
        const extraData = invoice.datos_extraidos as any;
        setEditingNit(extraData?.nit || "");

        setIsDialogOpen(true);
        if (invoice.url_archivo) {
            const signed = await getInvoiceSignedUrl(invoice.url_archivo);
            setSelectedInvoiceUrl(signed || invoice.url_archivo);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">Gestión de Facturas</h2>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex-1 flex flex-col sm:flex-row gap-4 items-center">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar usuario..."
                            value={filterUser}
                            onChange={(e) => setFilterUser(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="w-full sm:max-w-xs">
                        <Input
                            type="month"
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                        />
                    </div>
                </div>
                <Button onClick={exportToExcel} className="bg-[#1e3a5f] hover:bg-[#264d73] text-white w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" /> Exportar a Excel
                </Button>
            </div>

            {/* Desktop Table View */}
            <Card className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredInvoices.map((inv: any) => (
                            <TableRow key={inv.id}>
                                <TableCell>{inv.fecha_factura || inv.created_at.split('T')[0]}</TableCell>
                                <TableCell className="font-medium">{inv.proveedor}</TableCell>
                                <TableCell className="max-w-[200px] truncate" title={inv.descripcion}>{inv.descripcion}</TableCell>
                                <TableCell>Q{inv.monto?.toFixed(2)}</TableCell>
                                <TableCell>{inv.empleados?.nombre || inv.usuario_id}</TableCell>
                                <TableCell>
                                    <StatusBadge status={inv.estado} />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => handleViewInvoice(inv)}>
                                                <FileText className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle>Detalle de Factura</DialogTitle>
                                            </DialogHeader>
                                            <InvoiceDetailContent
                                                selectedInvoiceUrl={selectedInvoiceUrl}
                                                inv={selectedInvoice}
                                                editingMonto={editingMonto}
                                                setEditingMonto={setEditingMonto}
                                                editingProveedor={editingProveedor}
                                                setEditingProveedor={setEditingProveedor}
                                                editingNit={editingNit}
                                                setEditingNit={setEditingNit}
                                                editingFecha={editingFecha}
                                                setEditingFecha={setEditingFecha}
                                                editingDescription={editingDescription}
                                                setEditingDescription={setEditingDescription}
                                                selectedInvoice={selectedInvoice}
                                                handleStatusChange={handleStatusChange}
                                            />
                                        </DialogContent>
                                    </Dialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {filteredInvoices.map((inv: any) => (
                    <Card key={inv.id} className="border border-slate-200 overflow-hidden">
                        <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">{inv.proveedor}</h3>
                                    <p className="text-xs text-slate-500 truncate">{inv.fecha_factura || inv.created_at.split('T')[0]}</p>
                                </div>
                                <StatusBadge status={inv.estado} />
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-slate-500 block font-medium mb-0.5">Monto</span>
                                    <span className="text-slate-700 block font-bold">Q{inv.monto?.toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block font-medium mb-0.5">Usuario</span>
                                    <span className="text-slate-700 block">{inv.empleados?.nombre || inv.usuario_id}</span>
                                </div>
                            </div>

                            <div>
                                <span className="text-slate-500 font-medium mb-1 block text-xs">Descripción</span>
                                <p className="text-xs text-slate-700 line-clamp-2">{inv.descripcion || '—'}</p>
                            </div>

                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewInvoice(inv)}
                                        className="w-full mt-2"
                                    >
                                        <FileText className="h-4 w-4 mr-2" />
                                        Ver Detalle
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>Detalle de Factura</DialogTitle>
                                    </DialogHeader>
                                    <InvoiceDetailContent
                                        selectedInvoiceUrl={selectedInvoiceUrl}
                                        inv={selectedInvoice}
                                        editingMonto={editingMonto}
                                        setEditingMonto={setEditingMonto}
                                        editingProveedor={editingProveedor}
                                        setEditingProveedor={setEditingProveedor}
                                        editingNit={editingNit}
                                        setEditingNit={setEditingNit}
                                        editingFecha={editingFecha}
                                        setEditingFecha={setEditingFecha}
                                        editingDescription={editingDescription}
                                        setEditingDescription={setEditingDescription}
                                        selectedInvoice={selectedInvoice}
                                        handleStatusChange={handleStatusChange}
                                    />
                                </DialogContent>
                            </Dialog>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function InvoiceDetailContent({
    selectedInvoiceUrl,
    inv,
    editingMonto,
    setEditingMonto,
    editingProveedor,
    setEditingProveedor,
    editingNit,
    setEditingNit,
    editingFecha,
    setEditingFecha,
    editingDescription,
    setEditingDescription,
    selectedInvoice,
    handleStatusChange
}: any) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                {selectedInvoiceUrl ? (
                    <img src={selectedInvoiceUrl} alt="Factura" className="w-full rounded-md border" />
                ) : (
                    <div className="h-48 bg-gray-100 flex items-center justify-center rounded border">Cargando imagen...</div>
                )}
                <div className="mt-2 text-right">
                    <a href={selectedInvoiceUrl || inv?.url_archivo} target="_blank" className="text-sm text-blue-600 hover:underline flex items-center justify-end">
                        Ver original <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                </div>
            </div>
            <div className="space-y-4">
                <div className="space-y-3">
                    <div>
                        <span className="font-semibold text-sm">Monto (Q):</span>
                        <Input
                            type="number"
                            step="0.01"
                            value={editingMonto}
                            onChange={(e) => setEditingMonto(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <span className="font-semibold text-sm">Proveedor:</span>
                        <Input
                            type="text"
                            value={editingProveedor}
                            onChange={(e) => setEditingProveedor(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <span className="font-semibold text-sm">NIT:</span>
                        <Input
                            type="text"
                            value={editingNit}
                            onChange={(e) => setEditingNit(e.target.value)}
                            placeholder="NIT"
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <span className="font-semibold text-sm">Fecha:</span>
                        <Input
                            type="date"
                            value={editingFecha}
                            onChange={(e) => setEditingFecha(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <div className="text-sm pt-2">
                        <span className="font-semibold">Usuario:</span> <span className="text-slate-600">{selectedInvoice?.empleados?.nombre}</span>
                    </div>
                </div>
                <div>
                    <span className="font-semibold text-sm">Datos Extraídos:</span>
                    <p className="text-sm font-medium text-slate-800 break-words mt-1">
                        {inv.datos_extraidos
                            ? (typeof inv.datos_extraidos === 'object'
                                ? JSON.stringify(inv.datos_extraidos, null, 2)
                                : String(inv.datos_extraidos))
                            : '—'}
                    </p>
                </div>
                <div>
                    <span className="font-semibold text-sm">Descripción:</span>
                    <textarea
                        className="w-full mt-1 p-2 border rounded-md min-h-[100px]"
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        placeholder="Descripción de la factura..."
                    />
                </div>
                {selectedInvoice?.estado === 'pendiente' && (
                    <div className="flex flex-col gap-2 pt-4">
                        <Button onClick={() => selectedInvoice && handleStatusChange(String(selectedInvoice.id), 'aprobado')} className="bg-green-600 hover:bg-green-700 w-full">
                            <Check className="mr-2 h-4 w-4" /> Aprobar
                        </Button>
                        <Button onClick={() => selectedInvoice && handleStatusChange(String(selectedInvoice.id), 'rechazado')} variant="destructive" className="w-full">
                            <X className="mr-2 h-4 w-4" /> Rechazar
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        aprobado: "bg-green-500",
        rechazado: "bg-red-500",
        pagado: "bg-blue-500",
        pendiente: "bg-yellow-500"
    };
    return <Badge className={styles[status] || "bg-gray-500"}>{status.toUpperCase()}</Badge>;
}
