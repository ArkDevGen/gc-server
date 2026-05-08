import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import inventoryRoutes from './routes/inventory.routes';
import customersRoutes from './routes/customers.routes';
import vendorsRoutes from './routes/vendors.routes';
import poRoutes from './routes/po.routes';
import invoicesRoutes from './routes/invoices.routes';
import quotesRoutes from './routes/quotes.routes';
import buildsRoutes from './routes/builds.routes';
import surplusRoutes from './routes/surplus.routes';
import templatesRoutes from './routes/templates.routes';
import importRoutes from './routes/import.routes';
import transfersRoutes from './routes/transfers.routes';
import reportsRoutes from './routes/reports.routes';
import countsRoutes from './routes/counts.routes';
import supportRoutes from './routes/support.routes';
import { verifyOriginSecret } from './middleware/cloudflareSecret';

const app = express();

// ── Request logging (SOC 2) ───────────────────────────────────────
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Security headers (SOC 2) ──────────────────────────────────────
app.use(helmet());

// ── Rate limiting (SOC 2 — brute force protection) ────────────────
// Tight limit on auth endpoints: 10 attempts per 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
// General API limit: 300 requests per 15 min per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/', apiLimiter);

// ── CORS ──────────────────────────────────────────────────────────
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', inventoryRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/vendors', vendorsRoutes);
app.use('/api/purchase-orders', poRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/builds', buildsRoutes);
app.use('/api/surplus', surplusRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/import', importRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/counts', countsRoutes);
app.use('/api/support', supportRoutes);

// Serve frontend in production
if (env.NODE_ENV === 'production') {
  const frontendPath = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`GC Business Hub API running on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

export default app;
