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
const PORT = process.env.PORT || 3002;
const isProduction = process.env.NODE_ENV === 'production';

// ✅ Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3002', 'https://knowledge-portal.loc'],
  credentials: true
}));
// ✅ Compression middleware
app.use(compression());

// ✅ Logging middleware
app.use(morgan(isProduction ? 'combined' : 'dev'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(bigIntMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 50 : 100, // 50 requests per IP in production
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

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

// ✅ Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// ✅ Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: isProduction ? '1h' : 0,
  etag: true,
  lastModified: true
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  if (isProduction) {
    res.status(500).json({
      error: 'Something went wrong!',
      requestId: req.id
    });
  } else {
    res.status(500).json({
      error: err.message,
      stack: err.stack,
      requestId: req.id
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

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  if (isProduction) {
    res.status(500).json({
      error: 'Something went wrong!',
      requestId: req.id
    });
  } else {
    res.status(500).json({
      error: err.message,
      stack: err.stack,
      requestId: req.id
    });
  }
});

// ✅ 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl
  });
});

// ✅ Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// ✅ Initialize and start server
const startServer = async () => {
  try {
    console.log('🚀 Initializing database...');
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🎯 Frontend: http://localhost:${PORT}`);
      
      if (!isProduction) {
        console.log(`🔧 API available at: http://localhost:${PORT}/api`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};