'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function getQuotes() {
    const { data, error } = await supabase
        .from('project_quotes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching quotes:', error);
        return [];
    }
    return data;
}

export async function createQuote(formData: FormData) {
    const projectName = formData.get('project_name') as string;
    const clientName = formData.get('client_name') as string;
    const estimatedCost = formData.get('estimated_cost') as string;
    const description = formData.get('description') as string;

    const { error } = await supabase
        .from('project_quotes')
        .insert({
            project_name: projectName,
            client_name: clientName,
            estimated_cost: Number(estimatedCost),
            description: description,
            status: 'borrador'
        });

    if (error) throw new Error('Error creating quote: ' + error.message);
    revalidatePath('/dashboard');
    return { success: true };
}

export async function updateQuoteStatus(id: number, status: string) {
    const { error } = await supabase
        .from('project_quotes')
        .update({ status })
        .eq('id', id);

    if (error) throw new Error('Error updating quote: ' + error.message);
    revalidatePath('/dashboard');
    return { success: true };
}
