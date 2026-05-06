import { Request, Response, NextFunction } from 'express';

export const verifyOriginSecret = (req: Request, res: Response, next: NextFunction) => {
  if (req.headers['x-origin-secret'] !== process.env.ORIGIN_SECRET) {
    return res.status(403).end();
  }
  next();
};
