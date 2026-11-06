'use server';

import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';
import { revalidatePath } from 'next/cache';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || '',
});

// Helper to reliably get the Admin client at runtime, skipping module caching
function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ebuhmtmqeprvumalbbia.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || '',
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
}

export async function uploadInvoice(formData: FormData) {
    const supabase = getAdminClient();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
        throw new Error('Archivo y usuario son requeridos');
    }

    // 1. Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('facturas')
        .upload(fileName, buffer, {
            contentType: file.type,
            upsert: false
        });

    if (uploadError) {
        console.error('Upload Error:', uploadError);
        throw new Error('Error subiendo archivo: ' + uploadError.message);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
        .storage
        .from('facturas')
        .getPublicUrl(fileName);

    // Resolve UUID to numeric ID if needed
    let numericUserId: any = userId;
    if (userId && userId.includes('-')) {
        const { data: userData } = await supabase
            .from('empleados')
            .select('id')
            .eq('supabase_id', userId)
            .single();

        if (userData?.id) {
            numericUserId = userData.id;
        } else {
            throw new Error('Usuario no encontrado en la base de datos de empleados.');
        }
    } else {
        numericUserId = Number(userId);
    }

    // 2. Create initial record in DB
    const { data: invoice, error: dbError } = await supabase
        .from('facturas')
        .insert({
            usuario_id: numericUserId,
            url_archivo: publicUrl,
            estado: 'pendiente'
        })
        .select()
        .single();

    if (dbError) {
        console.error('DB Error:', dbError);
        throw new Error('Error guardando factura: ' + dbError.message);
    }

    // Return fileName (path) as well needed for download
    return { success: true, invoiceId: invoice.id, publicUrl, filePath: fileName };
}

export async function processInvoiceWithAI(invoiceId: number, filePathOrUrl: string) {
    const supabase = getAdminClient();
    try {
        let base64Image = '';

        let fileMimeType = 'image/jpeg';
        if (filePathOrUrl.toLowerCase().endsWith('.png')) fileMimeType = 'image/png';
        if (filePathOrUrl.toLowerCase().endsWith('.webp')) fileMimeType = 'image/webp';

        // If it's a PDF, we might need a different handling or model, but for now we try to pass it to Vision if supported, otherwise warn.
        if (filePathOrUrl.toLowerCase().endsWith('.pdf')) {
            throw new Error('El modelo de IA actual solo soporta análisis de imágenes (JPG, PNG). Por favor captura una foto en lugar de subir un PDF.');
        }

        // Check if input looks like a URL or a path
        if (filePathOrUrl.startsWith('http')) {
            const response = await fetch(filePathOrUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            base64Image = `data:${fileMimeType};base64,${buffer.toString('base64')}`;
        } else {
            // It's a file path in the bucket
            const { data, error } = await supabase
                .storage
                .from('facturas')
                .download(filePathOrUrl);

            if (error || !data) {
                console.warn('Direct download failed, trying signed URL...', error);

                // Fallback: Try signed URL
                const { data: signedData, error: signedError } = await supabase
                    .storage
                    .from('facturas')
                    .createSignedUrl(filePathOrUrl, 60);

                if (signedError || !signedData?.signedUrl) {
                    console.error('Signed URL creation failed:', signedError);
                    throw new Error('No se pudo descargar la imagen (Download/SignedURL falló). Verifique permisos.');
                }

                const response = await fetch(signedData.signedUrl);
                if (!response.ok) throw new Error('No se pudo obtener la imagen desde la URL firmada.');

                const ab = await response.arrayBuffer();
                const buff = Buffer.from(ab);
                base64Image = `data:${fileMimeType};base64,${buff.toString('base64')}`;
            } else {
                const arrayBuffer = await data.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                base64Image = `data:${fileMimeType};base64,${buffer.toString('base64')}`;
            }
        }
        // Call Google Gemini directly, bypassing Groq and Tesseract
        // Generates native structured JSON from the image
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || 'AIzaSyAufcidmjXdWA24qyGVuSLphTzMNSlIwiI');

        // Formatear el base64 para Gemini (borrando el prefijo data:image/jpeg;base64,)
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

        const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

        const prompt = 'Analiza esta factura y extrae: proveedor, NIT del proveedor, fecha, monto total y una breve descripción narrativa de la compra. Responde SOLO con un JSON válido con las claves: proveedor, nit, fecha (YYYY-MM-DD), monto (como numero), descripcion.';
        const imageParts = [
            {
                inlineData: {
                    data: base64Data,
                    mimeType: fileMimeType
                },
            },
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        const responseText = result.response.text();

        // Clean markdown block if returns ```json
        const cleanJSON = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const extractedData = JSON.parse(cleanJSON || '{}');

        // Update DB
        const { error } = await supabase
            .from('facturas')
            .update({
                proveedor: extractedData.proveedor,
                fecha_factura: extractedData.fecha,
                monto: extractedData.monto,
                descripcion: extractedData.descripcion,
                datos_extraidos: extractedData
            })
            .eq('id', invoiceId);

        if (error) throw error;

        revalidatePath('/dashboard');
        return { success: true, data: extractedData };

    } catch (error: any) {
        console.error('AI Processing Error:', error);
        return { success: false, error: error.message };
    }
}

export async function getInvoices(userId?: string) {
    const supabase = getAdminClient();
    let numericUserId: any = userId;

    if (userId && userId.includes('-')) {
        // Resolve UUID to numeric ID from empleados table
        const { data: userData } = await supabase
            .from('empleados')
            .select('id')
            .eq('supabase_id', userId)
            .single();

        if (userData?.id) {
            numericUserId = userData.id;
        } else {
            // Prevent 22P02 crash: User does not exist in empleados, so they have no invoices.
            return [];
        }
    } else if (userId) {
        numericUserId = Number(userId);
    }

    let query = supabase
        .from('facturas')
        .select(`
      *,
      empleados ( nombre )
    `)
        .order('created_at', { ascending: false });

    if (numericUserId) {
        query = query.eq('usuario_id', numericUserId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data;
}

export async function updateInvoiceStatus(invoiceId: number, status: string, note?: string, updates?: { descripcion?: string; proveedor?: string; fecha?: string; monto?: number; nit?: string }) {
    const supabase = getAdminClient();
    const payload: any = {
        estado: status,
        nota_admin: note
    };

    if (updates) {
        if (updates.descripcion) payload.descripcion = updates.descripcion;
        if (updates.proveedor) payload.proveedor = updates.proveedor;
        if (updates.fecha) payload.fecha_factura = updates.fecha;
        if (updates.monto) payload.monto = updates.monto;

        // Handle NIT - stored in JSONB
        if (updates.nit) {
            // First fetch existing data
            const { data: current } = await supabase.from('facturas').select('datos_extraidos').eq('id', invoiceId).single();
            const existingData = current?.datos_extraidos || {};
            payload.datos_extraidos = { ...existingData, nit: updates.nit };
        }
    }

    const { error } = await supabase
        .from('facturas')
        .update(payload)
        .eq('id', invoiceId);

    if (error) throw error;
    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteInvoice(invoiceId: number) {
    const supabase = getAdminClient();
    // 1. Get the file URL so we can delete from storage
    const { data: inv } = await supabase.from('facturas').select('url_archivo').eq('id', invoiceId).single();

    if (inv?.url_archivo) {
        // Extract filename from URL - assumes URL structure like /object/public/facturas/USERID/FILENAME
        const urlParts = inv.url_archivo.split('/');
        if (urlParts.length >= 2) {
            const fileName = urlParts.slice(-2).join('/'); // Gets USERID/FILENAME
            await supabase.storage.from('facturas').remove([fileName]);
        }
    }

    // 2. Delete row
    const { error } = await supabase.from('facturas').delete().eq('id', invoiceId);
    if (error) throw error;

    revalidatePath('/dashboard');
    return { success: true };
}

export async function getInvoiceSignedUrl(path: string) {
    const supabase = getAdminClient();
    if (path.startsWith('http')) {
        // Try to extract path from URL if full public URL is passed (legacy/fallback)
        // Format: .../storage/v1/object/public/facturas/userId/timestamp.ext
        const parts = path.split('/facturas/');
        if (parts.length > 1) {
            path = parts[1];
        } else {
            // Can't extract path, return original (might fail if private, but we tried)
            return path;
        }
    }

    const { data, error } = await supabase
        .storage
        .from('facturas')
        .createSignedUrl(path, 60 * 60); // 1 hour

    if (error) {
        console.error('Error creating signed URL:', error);
        return null; // or throw
    }

    return data.signedUrl;
}
