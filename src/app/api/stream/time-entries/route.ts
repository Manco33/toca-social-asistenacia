import { getPool } from '@/lib/mysql';
import { PassThrough } from 'stream';

export const runtime = 'nodejs';

let lastSentId = 0;

async function getLatestEntries(sinceId: number) {
  const p = getPool();
  const [rows] = await p.query(`SELECT * FROM ` + '\`horarios_gps\`' + ` WHERE id > ? ORDER BY id ASC`, [sinceId]);
  return rows as any[];
}

export async function GET(req: Request) {
  const stream = new PassThrough();

  // write a comment ping so client knows we're connected
  stream.write(': connected\n\n');

  // helper to write an SSE event
  const writeEvent = (dataObj: any) => {
    try {
      const data = JSON.stringify(dataObj);
      stream.write(`data: ${data}\n\n`);
    } catch (e) {
      stream.write(`event: error\ndata: ${JSON.stringify({ message: String(e) })}\n\n`);
    }
  };

  // send initial backlog
  (async () => {
    try {
      const initial = await getLatestEntries(lastSentId);
      for (const row of initial) {
        writeEvent({ id: row.id, usuario: row.usuario, tipo: row.tipo_actividad, fecha: row.fecha, hora: row.hora_marcaje, proyecto: row.proyecto, coordenadas: row.coordenadas });
        lastSentId = Math.max(lastSentId, row.id);
      }
    } catch (e) {
      writeEvent({ error: String(e) });
    }
  })();

  // poll for new rows every 2s
  const interval = setInterval(async () => {
    try {
      const rows = await getLatestEntries(lastSentId);
      for (const row of rows) {
        writeEvent({ id: row.id, usuario: row.usuario, tipo: row.tipo_actividad, fecha: row.fecha, hora: row.hora_marcaje, proyecto: row.proyecto, coordenadas: row.coordenadas });
        lastSentId = Math.max(lastSentId, row.id);
      }
    } catch (e) {
      writeEvent({ error: String(e) });
    }
  }, 2000);

  // cleanup when client disconnects
  const abort = (req as any).signal;
  if (abort && typeof abort.addEventListener === 'function') {
    abort.addEventListener('abort', () => {
      clearInterval(interval);
      try { stream.end(); } catch {}
    });
  }

  // wrap Node stream into a Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(chunk));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
    cancel() {
      try { stream.destroy(); } catch {}
    }
  });

  return new Response(webStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}
