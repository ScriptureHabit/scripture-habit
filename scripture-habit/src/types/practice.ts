import { z } from 'zod';

export const FirebaseTimestampSchema = z.union([
    z.object({
        seconds: z.number(),
        nanoseconds: z.number(),
    }),
    z.string(),
    z.instanceof(Date),
    z.number(),
    z.unknown()
]);