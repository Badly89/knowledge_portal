import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import articleRoutes from './routes/articles.js';
import { initDatabase, checkDatabaseHealth } from './utils/database.js';
import { bigIntMiddleware } from './middleware/bigintMiddleware.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// ✅ Настройка статических файлов UPLOADS
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use(express.static(path.join(process.cwd(), 'public')));

console.log('Static files configuration:');
console.log('Uploads path:', path.join(process.cwd(), 'public', 'uploads'));
console.log(`Files will be available at: http://localhost:${PORT}/uploads/filename`);

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

// ✅ Serve static files from dist directory (для фронтенда)
app.use(express.static(path.join(__dirname, 'dist')));

// ✅ Handle client-side routing (должен быть ПОСЛЕДНИМ)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Добавьте логирование для отладки
app.use('/uploads', (req, res, next) => {
  console.log('Static file request:', req.url);
  next();
});

// Initialize database and start server
console.log('🚀 Запуск инициализации базы данных...');
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Health check доступен по: http://localhost:${PORT}/health`);
    console.log(`📚 API доступен по: http://localhost:${PORT}/api`);
    console.log(`🎯 Frontend доступен по: http://localhost:${PORT}`);

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 Сброс БД (dev): POST http://localhost:${PORT}/api/dev/reset-db`);
    }
  });
}).catch(error => {
  console.error('❌ Не удалось запустить сервер:', error);
  process.exit(1);
});