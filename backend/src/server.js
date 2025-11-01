import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import articleRoutes from './routes/articles.js';
import { initDatabase } from './utils/database.js';
import { bigIntMiddleware } from './middleware/bigintMiddleware.js';

const app = express();
const PORT = process.env.PORT || 6500;


// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(bigIntMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/articles', articleRoutes);

// Health check with database status
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbHealth
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Database reset endpoint (only in development)
if (process.env.NODE_ENV === 'development') {
  app.post('/api/dev/reset-db', async (req, res) => {
    try {
      const { resetDatabase } = await import('./utils/database.js');
      await resetDatabase();
      res.json({ message: 'Database reset successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset database' });
    }
  });
}

// Initialize database and start server
console.log('🚀 Запуск инициализации базы данных...');
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Health check доступен по: http://localhost:${PORT}/health`);
    console.log(`📚 API доступен по: http://localhost:${PORT}/api`);

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 Сброс БД (dev): POST http://localhost:${PORT}/api/dev/reset-db`);
    }
  });
}).catch(error => {
  console.error('❌ Не удалось запустить сервер:', error);
  process.exit(1);
});