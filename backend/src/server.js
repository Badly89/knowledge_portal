import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import articleRoutes from './routes/articles.js';
import { initDatabase } from './utils/database.js';
import { bigIntMiddleware } from './middleware/bigintMiddleware.js';
import path from 'path';
// import { fileURLToPath } from 'url';




const app = express();
const PORT = process.env.PORT || 6500;

// ✅ ПРАВИЛЬНЫЙ путь к frontend папке
const frontendPath = path.join(process.cwd(), '../frontend');
const uploadsPath = path.join(frontendPath, 'public', 'uploads');

// ✅ ПРАВИЛЬНАЯ настройка статических файлов
// Или если вы хотите обслуживать всю public папку frontend
app.use(express.static(path.join(frontendPath, 'public')));
app.use('/uploads', express.static(path.join(frontendPath, 'uploads')));

console.log('Static files configuration:');
console.log('Frontend path:', frontendPath);
console.log('Uploads path:', uploadsPath);


// Добавьте логирование для отладки
app.use('/uploads', (req, res, next) => {
  console.log('Static file request:', req.url);
  next();
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(bigIntMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 300 // limit each IP to 100 requests per windowMs
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
