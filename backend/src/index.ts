import express from 'express';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { helmetMiddleware, corsMiddleware, globalLimiter, errorHandler } from './middleware/security.middleware';
import authRoutes from './routes/auth.routes';
import vaultRoutes from './routes/vault.routes';

const app = express();

// Set secure HTTP headers
app.use(helmetMiddleware);

// Enable CORS
app.use(corsMiddleware);

// Global Rate Limiting
app.use(globalLimiter);

// Body Parsers
app.use(express.json({ limit: '10kb' })); // Restrict payload size to prevent DOS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// Standard health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);

// Unhandled route fallback
app.all('*', (req, res, next) => {
  res.status(404).json({ error: `Can't find ${req.originalUrl} on this server.` });
});

// Centralized error handler
app.use(errorHandler);

// Start server
const server = app.listen(env.PORT, () => {
  console.log(`🛡️  SecureVault server running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
  });
});
