'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function getTickets() {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching tickets:', error);
        return [];
    }
    return data;
}

export async function createTicket(formData: FormData) {
    const clientName = formData.get('client_name') as string;
    const issueDescription = formData.get('issue_description') as string;
    const priority = formData.get('priority') as string;

    const { error } = await supabase
        .from('tickets')
        .insert({
            client_name: clientName,
            issue_description: issueDescription,
            priority: priority,
            status: 'abierto'
        });

    if (error) throw new Error('Error creating ticket: ' + error.message);
    revalidatePath('/dashboard');
    return { success: true };
}

export async function updateTicketStatus(id: number, status: string) {
    const { error } = await supabase
        .from('tickets')
        .update({ status })
        .eq('id', id);

    if (error) throw new Error('Error updating ticket: ' + error.message);
    revalidatePath('/dashboard');
    return { success: true };
}
