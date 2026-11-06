"use client";

import { useState, useEffect } from "react";
import { getTickets, createTicket, updateTicketStatus } from "@/app/support-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Ticket } from "lucide-react";

export function SupportDashboard() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadTickets();
    }, []);

    const loadTickets = async () => {
        const data = await getTickets();
        setTickets(data);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        try {
            await createTicket(formData);
            toast({ title: "Ticket creado" });
            setIsDialogOpen(false);
            loadTickets();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    };

    const handleStatusChange = async (id: number, status: string) => {
        await updateTicketStatus(id, status);
        loadTickets();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Panel de Soporte</h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Nuevo Ticket</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Ticket de Soporte</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Cliente</label>
                                <Input name="client_name" required placeholder="Nombre del cliente" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Descripción</label>
                                <Input name="issue_description" required placeholder="Descripción del problema" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Prioridad</label>
                                <select name="priority" className="w-full border rounded p-2 text-sm bg-background">
                                    <option value="baja">Baja</option>
                                    <option value="media">Media</option>
                                    <option value="alta">Alta</option>
                                    <option value="critica">Critica</option>
                                </select>
                            </div>
                            <Button type="submit" className="w-full">Crear Ticket</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" /> Tickets Activos</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Desktop View */}
                    <div className="hidden md:overflow-x-auto md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Problema</TableHead>
                                    <TableHead>Prioridad</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tickets.map((ticket) => (
                                    <TableRow key={ticket.id}>
                                        <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>{ticket.client_name}</TableCell>
                                        <TableCell>{ticket.issue_description}</TableCell>
                                        <TableCell>
                                            <Badge variant={ticket.priority === 'critica' || ticket.priority === 'alta' ? 'destructive' : 'secondary'}>
                                                {ticket.priority.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={ticket.status === 'abierto' ? 'outline' : 'default'} className={ticket.status === 'abierto' ? 'bg-yellow-100 text-yellow-800' : ''}>
                                                {ticket.status.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {ticket.status === 'abierto' && (
                                                <Button size="sm" variant="outline" onClick={() => handleStatusChange(ticket.id, 'cerrado')}>
                                                    Cerrar Ticket
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
                        {tickets.map((ticket) => (
                            <Card key={ticket.id} className="border border-slate-200 overflow-hidden">
                                <div className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 text-sm leading-tight">{ticket.client_name}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">{new Date(ticket.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <Badge variant={ticket.status === 'abierto' ? 'outline' : 'default'} className={ticket.status === 'abierto' ? 'bg-yellow-100 text-yellow-800' : ''}>
                                            {ticket.status.toUpperCase()}
                                        </Badge>
                                    </div>
                                    
                                    <div>
                                        <span className="text-slate-500 font-medium mb-1 block text-xs">Problema</span>
                                        <p className="text-xs text-slate-700 line-clamp-2">{ticket.issue_description}</p>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <Badge variant={ticket.priority === 'critica' || ticket.priority === 'alta' ? 'destructive' : 'secondary'}>
                                            {ticket.priority.toUpperCase()}
                                        </Badge>
                                        {ticket.status === 'abierto' && (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={() => handleStatusChange(ticket.id, 'cerrado')}
                                                className="text-xs"
                                            >
                                                Cerrar
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
