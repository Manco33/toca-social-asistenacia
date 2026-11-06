"use client";

import { useState, useEffect } from "react";
import { uploadInvoice, processInvoiceWithAI, getInvoices } from "@/app/invoice-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { Invoice } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export function InvoiceManager({ userId }: { userId: string }) {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [uploading, setUploading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { toast } = useToast();

    const loadInvoices = async () => {
        try {
            const data = await getInvoices(userId);
            setInvoices(data as Invoice[]);
        } catch (error) {
            console.error("Error loading invoices:", error);
        }
    };

    useEffect(() => {
        loadInvoices();
    }, [userId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("userId", userId);

        try {
            // 1. Upload
            const { success, invoiceId, publicUrl, filePath } = await uploadInvoice(formData);

            if (success) {
                toast({ title: "Factura subida", description: "Procesando con IA..." });
                setProcessingId(String(invoiceId));
                await loadInvoices(); // Refresh list to show 'pendiente'

                // 2. Process with AI
                // 2. Process with AI
                // Pass filePath if available, otherwise fall back to publicUrl
                const fileToProcess = filePath || publicUrl;
                const result = await processInvoiceWithAI(Number(invoiceId), fileToProcess);

                if (result.success) {
                    toast({ title: "Procesado completado", description: "Datos extraídos correctamente." });
                } else {
                    toast({ variant: "destructive", title: "Error en IA", description: result.error || "No se pudieron extraer datos." });
                }
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setUploading(false);
            setProcessingId(null);
            await loadInvoices();
        }
    };

    return (
        <div className="space-y-6">
            <Card className="border-2 border-dashed border-sky-200 bg-sky-50 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-center text-sky-800 text-xl font-bold">📷 Subir Nueva Factura</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-6 pb-8">
                    <p className="text-center text-slate-600 font-medium">
                        Toca una opción para subir tu factura
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
                        {/* Camera Button */}
                        <div className="relative group">
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleUpload}
                                disabled={uploading || !!processingId}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-[#1e3a5f] rounded-xl p-6 shadow-md transition-transform transform active:scale-95 group-hover:bg-blue-50 h-full">
                                <div className="bg-blue-100 p-4 rounded-full text-[#1e3a5f]">
                                    <Upload className="h-10 w-10" />
                                </div>
                                <span className="text-lg font-bold text-[#1e3a5f]">Tomar Foto</span>
                            </div>
                        </div>

                        {/* Gallery Button */}
                        <div className="relative group">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleUpload}
                                disabled={uploading || !!processingId}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-indigo-400 rounded-xl p-6 shadow-md transition-transform transform active:scale-95 group-hover:bg-indigo-50 h-full">
                                <div className="bg-indigo-100 p-4 rounded-full text-indigo-600">
                                    <FileText className="h-10 w-10" />
                                </div>
                                <span className="text-lg font-bold text-indigo-700">Galería de imágenes</span>
                            </div>
                        </div>
                    </div>

                    {uploading && (
                        <div className="flex flex-col items-center animate-pulse mt-4">
                            <Loader2 className="h-8 w-8 text-[#1e3a5f] animate-spin" />
                            <span className="text-[#1e3a5f] font-medium mt-2">Subiendo y analizando...</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {invoices.map((inv) => (
                    <Card key={inv.id} className="relative overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {inv.proveedor || "Desconocido"}
                            </CardTitle>
                            <StatusBadge status={inv.estado} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Q{inv.monto?.toFixed(2) || "0.00"}</div>
                            <p className="text-xs text-muted-foreground mb-4">
                                {inv.fecha_factura || inv.created_at.split('T')[0]}
                            </p>
                            <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                                {inv.descripcion || "Sin descripción"}
                            </p>

                            <div className="flex justify-between items-center">
                                <a href={inv.url_archivo} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" size="sm">
                                        <FileText className="h-4 w-4 mr-2" /> Ver Archivo
                                    </Button>
                                </a>
                                {processingId === inv.id && (
                                    <Badge variant="secondary" className="animate-pulse">
                                        Analizando IA...
                                    </Badge>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {invoices.length === 0 && (
                    <div className="col-span-full text-center py-10 text-slate-500">
                        No has subido facturas aún.
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'aprobado':
            return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Aprobado</Badge>;
        case 'rechazado':
            return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rechazado</Badge>;
        case 'pagado':
            return <Badge className="bg-blue-500">Pagado</Badge>;
        default:
            return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
    }
}
