declare module 'cors' {
  import type { RequestHandler } from 'express';
  const cors: (options?: unknown) => RequestHandler;

  export default cors;
}
