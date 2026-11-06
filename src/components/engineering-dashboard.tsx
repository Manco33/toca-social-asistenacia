"use client";

import { useState, useEffect } from "react";
import { getQuotes, createQuote, updateQuoteStatus } from "@/app/engineering-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { HardHat, Plus } from "lucide-react";

export function EngineeringDashboard() {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadQuotes();
    }, []);

    const loadQuotes = async () => {
        const data = await getQuotes();
        setQuotes(data);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        try {
            await createQuote(formData);
            toast({ title: "Cotización creada" });
            setIsDialogOpen(false);
            loadQuotes();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const handleStatusChange = async (id: number, status: string) => {
        await updateQuoteStatus(id, status);
        loadQuotes();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Ingeniería y Proyectos</h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Nueva Cotización</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Nueva Cotización de Proyecto</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Nombre del Proyecto</label>
                                <Input name="project_name" required placeholder="Ej: Instalación Cámaras Edificio X" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Cliente</label>
                                <Input name="client_name" required placeholder="Nombre del cliente" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Costo Estimado (Q)</label>
                                <Input name="estimated_cost" type="number" required placeholder="0.00" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Descripción / Detalles Técnicos</label>
                                <textarea name="description" className="w-full border rounded p-2 text-sm bg-background min-h-[100px]" placeholder="Detalles de instalación, equipos, etc." />
                            </div>
                            <Button type="submit" className="w-full">Guardar Borrador</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><HardHat className="h-5 w-5" /> Cotizaciones Recientes</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Desktop View */}
                    <div className="hidden md:overflow-x-auto md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Proyecto</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Costo Est.</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotes.map((quote) => (
                                    <TableRow key={quote.id}>
                                        <TableCell className="font-medium">{quote.project_name}</TableCell>
                                        <TableCell>{quote.client_name}</TableCell>
                                        <TableCell>Q{quote.estimated_cost}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{quote.status.toUpperCase()}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {quote.status === 'borrador' && (
                                                <Button size="sm" onClick={() => handleStatusChange(quote.id, 'enviado')}>
                                                    Marcar Enviado
                                                </Button>
                                            )}
                                            {quote.status === 'enviado' && (
                                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange(quote.id, 'aprobado')}>
                                                    Aprobar
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile View - Card Layout */}
                    <div className="md:hidden space-y-3">
                        {quotes.map((quote) => (
                            <Card key={quote.id} className="border border-slate-200 overflow-hidden">
                                <div className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 text-sm leading-tight">{quote.project_name}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">{quote.client_name}</p>
                                        </div>
                                        <Badge variant="outline">{quote.status.toUpperCase()}</Badge>
                                    </div>
                                    
                                    <div>
                                        <span className="text-slate-500 font-medium mb-1 block text-xs">Costo Estimado</span>
                                        <p className="text-sm text-slate-700 font-bold">Q{quote.estimated_cost}</p>
                                    </div>
                                    
                                    <div className="flex gap-2 pt-2 border-t border-slate-200">
                                        {quote.status === 'borrador' && (
                                            <Button 
                                                size="sm" 
                                                onClick={() => handleStatusChange(quote.id, 'enviado')}
                                                className="flex-1 text-xs"
                                            >
                                                Marcar Enviado
                                            </Button>
                                        )}
                                        {quote.status === 'enviado' && (
                                            <Button 
                                                size="sm" 
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-xs"
                                                onClick={() => handleStatusChange(quote.id, 'aprobado')}
                                            >
                                                Aprobar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
