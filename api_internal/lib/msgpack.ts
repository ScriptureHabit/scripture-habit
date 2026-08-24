import { Request, Response, NextFunction } from 'express';
import { encode } from '@msgpack/msgpack';

/**
 * Middleware enabling transparent MessagePack binary responses when requested by clients.
 * Activates when the client sends Accept: application/x-msgpack.
 */
export function msgpackMiddleware(req: Request, res: Response, next: NextFunction): void {
  const acceptHeader = req.headers['accept'] || '';
  const acceptsMsgpack = typeof acceptHeader === 'string' && acceptHeader.includes('application/x-msgpack');

  if (acceptsMsgpack) {
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      try {
        const encoded = encode(body);
        res.setHeader('Content-Type', 'application/x-msgpack');
        return res.send(Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength));
      } catch (err) {
        console.warn('[MsgPack] Encoding error, falling back to standard JSON:', err);
        return originalJson(body);
      }
    };
  }

  next();
}
