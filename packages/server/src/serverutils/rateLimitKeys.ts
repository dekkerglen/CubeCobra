import type { Request } from 'express';

/** Consistent rate-limit key generator: user ID when logged in, IP address otherwise. */
export const userOrIpKey = (req: Request): string => (req as any).user?.id?.toString() ?? (req as any).ip ?? 'anon';
