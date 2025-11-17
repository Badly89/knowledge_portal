import express from 'express';
import { optionalAuth, requireAuth, isAdmin } from '../middleware/auth.js';
import { getConnection } from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// ✅ Путь к frontend папке для загрузок
const frontendPath = path.join(process.cwd(), '../frontend');
const uploadsPath = path.join(frontendPath, 'public', 'uploads', 'tinymce');

// ✅ Функция для создания директорий
const ensureUploadDirs = () => {
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log('✅ Created upload directory:', uploadsPath);
  }
};

ensureUploadDirs();

// ✅ Настройка multer для сохранения файлов во frontend
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDirs(); // Убедимся что папка существует
    cb(null, uploadsPath);
  },
  filename: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname);
    const fileName = `image-${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
    cb(null, fileName);
  }
});

// Фильтр для проверки типа файла
const fileFilter = (req, file, cb) => {
  // Для изображений TinyMCE
  if (file.fieldname === 'file') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения'), false);
    }
  }
  // Для обычных файлов (если нужно)
  else {
    cb(null, true);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});


const extractImageFilenamesFromContent = (content) => {
  if (!content || typeof content !== 'string') {
    console.log('⚠️ Контент пуст или не является строкой');
    return [];
  }

  const imageFilenames = [];

  try {
    console.log('🔍 Анализ контента для извлечения изображений...');

    // 1. Поиск в формате API URL (/api/articles/uploads/tinymce/)
    const apiImageRegex = /\/api\/articles\/uploads\/tinymce\/([a-zA-Z0-9\-_.]+\.(jpg|jpeg|png|gif|webp|svg))/gi;

    // 2. Поиск в формате прямого пути (/uploads/tinymce/)
    const directImageRegex = /\/uploads\/tinymce\/([a-zA-Z0-9\-_.]+\.(jpg|jpeg|png|gif|webp|svg))/gi;

    // 3. Поиск в src атрибутах
    const srcRegex = /src=["']([^"']*\/tinymce\/[a-zA-Z0-9\-_.]+\.(jpg|jpeg|png|gif|webp|svg))["']/gi;

    // 4. Поиск в data атрибутах
    const dataRegex = /data-image=["']([^"']*\/tinymce\/[a-zA-Z0-9\-_.]+\.(jpg|jpeg|png|gif|webp|svg))["']/gi;

    const patterns = [
      { regex: apiImageRegex, type: 'api-url' },
      { regex: directImageRegex, type: 'direct-url' },
      { regex: srcRegex, type: 'src-attribute' },
      { regex: dataRegex, type: 'data-attribute' }
    ];

    patterns.forEach(({ regex, type }) => {
      let match;
      console.log(`🔍 Поиск по шаблону: ${type}`);

      while ((match = regex.exec(content)) !== null) {
        let filename = null;

        if (type === 'api-url' || type === 'direct-url') {
          filename = match[1];
        } else if (type === 'src-attribute' || type === 'data-attribute') {
          // Извлекаем имя файла из полного URL/path
          const fullPath = match[1];
          filename = fullPath.split('/').pop();
        }

        if (filename && isValidImageFilename(filename)) {
          console.log(`✅ Найден файл (${type}): ${filename}`);
          imageFilenames.push(filename);
        }
      }
    });

    // Убираем дубликаты и возвращаем результат
    const uniqueFilenames = [...new Set(imageFilenames)];
    console.log(`📊 Итог: найдено ${uniqueFilenames.length} уникальных файлов`);

    return uniqueFilenames;

  } catch (error) {
    console.error('❌ Ошибка извлечения имен файлов из контента:', error);
    return [];
  }
};


/**
 * Проверяет валидность имени файла изображения
 * @param {string} filename - Имя файла для проверки
 * @returns {boolean} true если валидное
 */
const isValidImageFilename = (filename) => {
  if (!filename || typeof filename !== 'string') return false;

  // Проверяем расширение файла
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const extension = path.extname(filename).toLowerCase();

  if (!validExtensions.includes(extension)) {
    console.log(`⚠️ Неверное расширение файла: ${filename}`);
    return false;
  }

  // Проверяем формат имени (должно соответствовать нашему шаблону)
  const filenamePattern = /^image-\d+-\d+\.(jpg|jpeg|png|gif|webp|svg)$/i;
  const isValid = filenamePattern.test(filename) || /^[a-zA-Z0-9\-_.]+$/.test(filename);

  if (!isValid) {
    console.log(`⚠️ Подозрительное имя файла: ${filename}`);
  }

  return isValid;
};


/**
 * Безопасно удаляет файл с обработкой ошибок
 * @param {string} filePath - Полный путь к файлу
 * @returns {Promise<Object>} Результат операции
 */
const safeDeleteFile = (filePath) => {
  return new Promise((resolve) => {
    // Проверяем, что путь находится в разрешенной директории
    if (!isPathInUploadsDirectory(filePath)) {
      console.error(`🚨 Попытка удаления файла вне разрешенной директории: ${filePath}`);
      return resolve({
        success: false,
        error: 'Путь вне разрешенной директории',
        filePath
      });
    }

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ Файл не существует: ${filePath}`);
      return resolve({
        success: true,
        message: 'Файл не существует',
        filePath
      });
    }

    // Проверяем, что это файл, а не директория
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      console.error(`🚨 Попытка удаления директории вместо файла: ${filePath}`);
      return resolve({
        success: false,
        error: 'Указанный путь ведет к директории',
        filePath
      });
    }

    // Получаем информацию о файле перед удалением
    const fileInfo = {
      name: path.basename(filePath),
      size: stats.size,
      modified: stats.mtime
    };

    // Выполняем удаление
    fs.unlink(filePath, (error) => {
      if (error) {
        console.error(`❌ Ошибка удаления файла ${filePath}:`, error);
        resolve({
          success: false,
          error: error.message,
          filePath,
          fileInfo
        });
      } else {
        console.log(`✅ Файл успешно удален: ${filePath} (${fileInfo.size} bytes)`);
        resolve({
          success: true,
          message: 'Файл успешно удален',
          filePath,
          fileInfo
        });
      }
    });
  });
};
/**
 * Проверяет, что путь находится в разрешенной директории uploads
 * @param {string} filePath - Проверяемый путь
 * @returns {boolean} true если путь безопасный
 */
const isPathInUploadsDirectory = (filePath) => {
  try {
    const normalizedFilePath = path.resolve(filePath);
    const normalizedUploadsPath = path.resolve(uploadsPath);

    // Проверяем, что файл находится внутри uploads директории
    const isSafe = normalizedFilePath.startsWith(normalizedUploadsPath);

    if (!isSafe) {
      console.error(`🚨 Небезопасный путь: ${normalizedFilePath}`);
      console.error(`🚨 Ожидаемая директория: ${normalizedUploadsPath}`);
    }

    return isSafe;
  } catch (error) {
    console.error('Ошибка проверки пути:', error);
    return false;
  }
};

/**
 * Извлекает имена файлов из полей images и articles
 * @param {Object} article - Объект статьи
 * @returns {string[]} Массив имен файлов
 */
const extractFilenamesFromArticleFields = (article) => {
  const filenames = [];

  if (!article) return filenames;

  try {
    // Обрабатываем поле images
    if (article.images && Array.isArray(article.images)) {
      article.images.forEach((image, index) => {
        if (image && typeof image === 'object') {
          // Пытаемся извлечь имя файла разными способами
          const possibleFields = ['filename', 'fileName', 'name', 'filePath', 'path', 'url'];

          for (const field of possibleFields) {
            if (image[field] && typeof image[field] === 'string') {
              const filename = extractFilenameFromPath(image[field]);
              if (filename && isValidImageFilename(filename)) {
                console.log(`✅ Найден файл в images[${index}].${field}: ${filename}`);
                filenames.push(filename);
                break;
              }
            }
          }
        }
      });
    }

    // Обрабатываем поле files
    if (article.files && Array.isArray(article.files)) {
      article.files.forEach((file, index) => {
        if (file && typeof file === 'object') {
          const possibleFields = ['filename', 'fileName', 'name', 'filePath', 'path', 'url'];

          for (const field of possibleFields) {
            if (file[field] && typeof file[field] === 'string') {
              const filename = extractFilenameFromPath(file[field]);
              if (filename) {
                console.log(`✅ Найден файл в files[${index}].${field}: ${filename}`);
                filenames.push(filename);
                break;
              }
            }
          }
        }
      });
    }

  } catch (error) {
    console.error('❌ Ошибка извлечения файлов из полей статьи:', error);
  }

  return [...new Set(filenames)]; // Убираем дубликаты
};

/**
 * Извлекает имя файла из полного пути или URL
 * @param {string} pathOrUrl - Путь или URL
 * @returns {string} Имя файла
 */
const extractFilenameFromPath = (pathOrUrl) => {
  if (!pathOrUrl) return null;

  try {
    // Если это URL, извлекаем путь
    let filePath = pathOrUrl;
    if (pathOrUrl.includes('://')) {
      const url = new URL(pathOrUrl);
      filePath = url.pathname;
    }

    // Извлекаем имя файла
    const filename = path.basename(filePath);

    // Проверяем, что имя файла не пустое и не содержит подозрительных символов
    if (filename && filename.length > 0 && !filename.includes('..') && !filename.includes('/')) {
      return filename;
    }

    return null;
  } catch (error) {
    console.error(`Ошибка извлечения имени файла из "${pathOrUrl}":`, error);
    return null;
  }
};


// ✅ СТАТИЧЕСКАЯ РАЗДАЧА ФАЙЛОВ ИЗ РОУТЕРА
// Это ключевое решение - обслуживаем файлы через API маршрут
router.use('/uploads/tinymce', express.static(uploadsPath, {
  // Дополнительные настройки для лучшей производительности
  maxAge: '1d', // Кэширование на 1 день
  etag: true,
  lastModified: true
}));

// Вспомогательная функция для преобразования BigInt в Number
const convertBigIntToNumber = (obj) => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'bigint') {
    return Number(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }

  if (typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = convertBigIntToNumber(obj[key]);
    }
    return newObj;
  }

  return obj;
};

// Вспомогательная функция для безопасной обработки JSON
const safeJSONParse = (data) => {
  if (!data) return [];
  try {
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error) {
    console.error('JSON parse error:', error);
    return [];
  }
};

// Функция для безопасного преобразования дат
const safeDateConvert = (dateString) => {
  if (!dateString) return null;

  // Если это уже Date объект
  if (dateString instanceof Date) {
    return isNaN(dateString.getTime()) ? null : dateString.toISOString();
  }

  // Если это timestamp
  if (typeof dateString === 'number' || (typeof dateString === 'string' && /^\d+$/.test(dateString))) {
    const date = new Date(Number(dateString));
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  // Если это строковая дата
  if (typeof dateString === 'string') {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
};

// Функция для обработки статьи и преобразования дат
const processArticleDates = (article) => {
  if (!article) return article;

  return {
    ...article,
    created_at: safeDateConvert(article.created_at),
    updated_at: safeDateConvert(article.updated_at),
    files: safeJSONParse(article.files),
    images: safeJSONParse(article.images)
  };
};

// Функция для обработки файлов при обновлении
const processFilesForUpdate = (existingFiles, newFiles, filesToRemove = []) => {
  // Фильтруем существующие файлы, удаляя отмеченные для удаления
  const filteredExistingFiles = existingFiles.filter(file =>
    !filesToRemove.includes(file.id)
  );

  // Обрабатываем новые файлы
  const processedNewFiles = newFiles ? newFiles.map(file => ({
    id: file.id || uuidv4(),
    name: file.name,
    type: file.type,
    size: file.size,
    data: file.data,
    isNew: !file.id // Помечаем новые файлы
  })) : [];

  // Объединяем существующие и новые файлы
  return [...filteredExistingFiles, ...processedNewFiles];
};

// Функция для обработки изображений при обновлении
const processImagesForUpdate = (existingImages, newImages, imagesToRemove = []) => {
  // Фильтруем существующие изображения, удаляя отмеченные для удаления
  const filteredExistingImages = existingImages.filter(image =>
    !imagesToRemove.includes(image.id)
  );

  // Обрабатываем новые изображения
  const processedNewImages = newImages ? newImages.map(image => ({
    id: image.id || uuidv4(),
    name: image.name,
    type: image.type,
    data: image.data,
    isNew: !image.id // Помечаем новые изображения
  })) : [];

  // Объединяем существующие и новые изображения
  return [...filteredExistingImages, ...processedNewImages];
};


/**
 * Основная функция для удаления всех файлов, связанных со статьей
 * @param {Object} article - Объект статьи
 * @returns {Promise<Object>} Результат операции
 */
const deleteArticleFiles = async (article) => {
  const deletionResults = {
    articleId: article.id,
    deletedFiles: [],
    errors: [],
    totalDeleted: 0,
    hasErrors: false,
    startTime: new Date(),
    endTime: null,
    duration: null
  };

  try {
    console.log(`🗑️ Начало удаления файлов для статьи ${article.id}...`);

    if (!article) {
      throw new Error('Статья не определена');
    }

    // 1. Собираем все возможные файлы статьи
    const allFilenames = new Set();

    // Файлы из HTML контента
    const contentFiles = extractImageFilenamesFromContent(article.content);
    contentFiles.forEach(file => allFilenames.add(file));

    // Файлы из полей images и files
    const fieldFiles = extractFilenamesFromArticleFields(article);
    fieldFiles.forEach(file => allFilenames.add(file));

    console.log(`📋 Всего файлов для проверки: ${allFilenames.size}`);

    // 2. Удаляем каждый файл
    for (const filename of allFilenames) {
      const filePath = path.join(uploadsPath, filename);

      console.log(`🔄 Обработка файла: ${filename}`);
      const result = await safeDeleteFile(filePath);

      if (result.success) {
        deletionResults.deletedFiles.push({
          filename,
          size: result.fileInfo?.size,
          path: filePath
        });
        deletionResults.totalDeleted++;
      } else {
        deletionResults.errors.push({
          filename,
          error: result.error,
          path: filePath
        });
        deletionResults.hasErrors = true;
      }
    }

    // 3. Записываем время завершения
    deletionResults.endTime = new Date();
    deletionResults.duration = deletionResults.endTime - deletionResults.startTime;

    // 4. Формируем итоговый отчет
    console.log(`📊 Итог удаления файлов статьи ${article.id}:`);
    console.log(`✅ Удалено: ${deletionResults.totalDeleted} файлов`);
    console.log(`❌ Ошибок: ${deletionResults.errors.length}`);
    console.log(`⏱️ Время выполнения: ${deletionResults.duration}ms`);

    if (deletionResults.deletedFiles.length > 0) {
      console.log('🗂️ Удаленные файлы:', deletionResults.deletedFiles.map(f => f.filename));
    }

    if (deletionResults.errors.length > 0) {
      console.error('🚨 Ошибки при удалении:', deletionResults.errors);
    }

    return deletionResults;

  } catch (error) {
    console.error(`❌ Критическая ошибка в deleteArticleFiles для статьи ${article.id}:`, error);

    deletionResults.endTime = new Date();
    deletionResults.duration = deletionResults.endTime - deletionResults.startTime;
    deletionResults.errors.push({
      type: 'critical',
      error: error.message
    });
    deletionResults.hasErrors = true;

    return deletionResults;
  }
};

/**
 * Создает резервную копию файлов перед удалением (опционально)
 * @param {string[]} filenames - Массив имен файлов
 * @param {string} backupDir - Директория для бэкапа
 * @returns {Promise<Object>} Результат операции
 */
const createFilesBackup = async (filenames, backupDir = null) => {
  if (!backupDir) {
    backupDir = path.join(uploadsPath, 'backups', `backup-${Date.now()}`);
  }

  const backupResults = {
    backupDir,
    backedUpFiles: [],
    errors: [],
    totalBackedUp: 0
  };

  try {
    // Создаем директорию для бэкапа
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`💾 Создание бэкапа в: ${backupDir}`);

    for (const filename of filenames) {
      const sourcePath = path.join(uploadsPath, filename);
      const backupPath = path.join(backupDir, filename);

      if (fs.existsSync(sourcePath)) {
        try {
          // Копируем файл
          fs.copyFileSync(sourcePath, backupPath);
          backupResults.backedUpFiles.push(filename);
          backupResults.totalBackedUp++;
          console.log(`✅ Файл скопирован в бэкап: ${filename}`);
        } catch (error) {
          console.error(`❌ Ошибка копирования файла ${filename}:`, error);
          backupResults.errors.push({
            filename,
            error: error.message
          });
        }
      }
    }

    console.log(`📦 Бэкап завершен: ${backupResults.totalBackedUp} файлов`);

  } catch (error) {
    console.error('❌ Ошибка создания бэкапа:', error);
    backupResults.errors.push({
      type: 'backup',
      error: error.message
    });
  }

  return backupResults;
};

//маршруты

// ✅ ДОПОЛНИТЕЛЬНО: Маршрут для отдачи файлов через контроллер (альтернатива static)
router.get('/uploads/tinymce/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsPath, filename);

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Файл не найден',
        filename: filename,
        path: filePath
      });
    }

    // Определяем Content-Type по расширению файла
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Устанавливаем заголовки
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 часа

    // Отправляем файл
    res.sendFile(filePath);

  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Ошибка при отдаче файла' });
  }
});


// ✅ Исправленный маршрут загрузки
// ✅ Маршрут загрузки для TinyMCE
router.post('/tinymce/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('TinyMCE upload request received');

    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const file = req.file;
    // const imageUrl = `/public/uploads/tinymce/${file.filename}`;
    // ✅ ВАРИАНТ 1: Относительный URL (рекомендуется)
    const imageUrl = `/api/articles/uploads/tinymce/${file.filename}`;

    console.log('✅ File uploaded successfully:', {
      originalName: file.originalname,
      savedName: file.filename,
      size: file.size,
      publicUrl: imageUrl,
      fullPath: file.path
    });

    res.json({
      location: imageUrl
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Ошибка загрузки изображения',
      details: error.message
    });
  }
});
router.delete('/uploads/tinymce/:filename', optionalAuth, isAdmin, (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsPath, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    fs.unlinkSync(filePath);

    res.json({
      message: 'Файл успешно удален',
      filename: filename
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

// Обработчик ошибок multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Размер файла слишком большой',
        details: 'Максимальный размер файла: 5MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Слишком много файлов',
        details: 'Можно загрузить только один файл за раз'
      });
    }
  }

  if (error.message.includes('Разрешены только изображения')) {
    return res.status(400).json({
      error: 'Неверный тип файла',
      details: 'Разрешены только файлы изображений (JPEG, PNG, GIF, etc.)'
    });
  }

  next(error);
});

// Получить все статьи с информацией о категориях (публичный доступ)
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const articles = await conn.query(`
      SELECT a.*, c.name as category_name, u.username as author_name ,COALESCE(av.view_count, 0) as viewscount
      FROM articles a 
      LEFT JOIN categories c ON a.category_id = c.id 
      LEFT JOIN users u ON a.created_by = u.id 
      LEFT JOIN article_views av ON a.id = av.article_id
      ORDER BY a.created_at DESC
    `);

    // Обрабатываем JSON поля и даты
    const processedArticles = articles.map(processArticleDates);

    res.json(processedArticles);
  } catch (error) {
    console.error('Ошибка получения статей:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Получить статью по ID (публичный доступ)
router.get('/:id', async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await getConnection();

    const articles = await conn.query(`
      SELECT a.*, c.name as category_name, u.username as author_name, COALESCE(av.view_count, 0) as  viewcount
      FROM articles a 
      LEFT JOIN categories c ON a.category_id = c.id 
      LEFT JOIN users u ON a.created_by = u.id 
      LEFT JOIN article_views av ON a.id = av.article_id
      WHERE a.id = ?
    `, [id]);

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const processedArticle = processArticleDates(articles[0]);
    res.json(processedArticle);
  } catch (error) {
    console.error('Ошибка получения статьи:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Получить статью для редактирования (с дополнительной информацией)
router.get('/:id/edit', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await getConnection();

    const articles = await conn.query(`
      SELECT a.*, c.name as category_name, u.username as author_name 
      FROM articles a 
      LEFT JOIN categories c ON a.category_id = c.id 
      LEFT JOIN users u ON a.created_by = u.id 
      WHERE a.id = ?
    `, [id]);

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const processedArticle = processArticleDates(articles[0]);

    // Добавляем дополнительную информацию для редактирования
    const editArticle = {
      ...processedArticle,
      // Информация о файлах для интерфейса редактирования
      filesInfo: processedArticle.files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: file.uploadedAt || file.created_at
      })),
      // Информация об изображениях для интерфейса редактирования
      imagesInfo: processedArticle.images.map(image => ({
        id: image.id,
        name: image.name,
        type: image.type,
        uploadedAt: image.uploadedAt || image.created_at
      }))
    };

    res.json(editArticle);
  } catch (error) {
    console.error('Ошибка получения статьи:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Создать статью (только для администраторов)
router.post('/', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { title, content, category_id, files, images, enable_slideshow = false } = req.body;
    conn = await getConnection();

    // Process files and images (store as base64 in database)
    const processedFiles = files ? files.map(file => ({
      id: uuidv4(),
      name: file.name,
      type: file.type,
      size: file.size,
      data: file.data, // base64 encoded
      uploadedAt: new Date().toISOString()
    })) : [];

    const processedImages = images ? images.map(image => ({
      id: uuidv4(),
      name: image.name,
      type: image.type,
      data: image.data, // base64 encoded
      uploadedAt: new Date().toISOString()
    })) : [];

    const result = await conn.query(
      `INSERT INTO articles (title, content, category_id, created_by, files, images, enable_slideshow)
       VALUES (?, ?, ?, ?, ?, ?,?)`,
      [
        title,
        content,
        category_id,
        req.user.userId,
        JSON.stringify(processedFiles),
        JSON.stringify(processedImages),
        enable_slideshow
      ]
    );

    // Получаем созданную статью с обработкой JSON
    const newArticles = await conn.query(`
      SELECT a.*, c.name as category_name, u.username as author_name 
      FROM articles a 
      LEFT JOIN categories c ON a.category_id = c.id 
      LEFT JOIN users u ON a.created_by = u.id 
      WHERE a.id = ?
    `, [result.insertId]);

    const processedArticle = processArticleDates(newArticles[0]);

    res.status(201).json({
      ...processedArticle,
      message: 'Статья успешно создана'
    });
  } catch (error) {
    console.error('Ошибка создания статьи:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Обновить статью с поддержкой управления файлами и изображениями
router.put('/:id', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const {
      title,
      content,
      category_id,
      files,
      images,
      filesToRemove = [],
      imagesToRemove = [],
      enable_slideshow = false
    } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Название статьи обязательно' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Содержание статьи обязательно' });
    }

    conn = await getConnection();

    // Проверяем существование статьи и получаем текущие данные
    const existingArticles = await conn.query(
      'SELECT * FROM articles WHERE id = ?',
      [id]
    );

    if (existingArticles.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const existingArticle = processArticleDates(existingArticles[0]);
    const currentFiles = existingArticle.files || [];
    const currentImages = existingArticle.images || [];

    // Обрабатываем файлы: удаляем отмеченные и добавляем новые
    const updatedFiles = processFilesForUpdate(currentFiles, files, filesToRemove);

    // Обрабатываем изображения: удаляем отмеченные и добавляем новые
    const updatedImages = processImagesForUpdate(currentImages, images, imagesToRemove);

    // Обновляем статью
    await conn.query(
      `UPDATE articles 
       SET title = ?, content = ?, category_id = ?, files = ?, images = ?, enable_slideshow = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title.trim(),
        content.trim(),
        category_id,
        JSON.stringify(updatedFiles),
        JSON.stringify(updatedImages),
        enable_slideshow,
        id
      ]
    );

    // Получаем обновленную статью с обработкой JSON
    const updatedArticles = await conn.query(`
      SELECT a.*, c.name as category_name, u.username as author_name 
      FROM articles a 
      LEFT JOIN categories c ON a.category_id = c.id 
      LEFT JOIN users u ON a.created_by = u.id 
      WHERE a.id = ?
    `, [id]);

    const processedArticle = processArticleDates(updatedArticles[0]);

    // Формируем информацию об изменениях
    const changes = {
      files: {
        added: updatedFiles.filter(f => f.isNew).length,
        removed: filesToRemove.length,
        total: updatedFiles.length
      },
      images: {
        added: updatedImages.filter(img => img.isNew).length,
        removed: imagesToRemove.length,
        total: updatedImages.length
      }
    };

    res.json({
      ...processedArticle,
      changes,
      message: 'Статья успешно обновлена'
    });
  } catch (error) {
    console.error('Ошибка обновления статьи:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Удалить конкретный файл из статьи
router.delete('/:id/files/:fileId', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { id, fileId } = req.params;
    conn = await getConnection();

    // Получаем текущую статью
    const articles = await conn.query(
      'SELECT * FROM articles WHERE id = ?',
      [id]
    );

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const article = processArticleDates(articles[0]);
    const currentFiles = article.files || [];

    // Фильтруем файлы, удаляя указанный
    const updatedFiles = currentFiles.filter(file => file.id !== fileId);

    // Обновляем статью
    await conn.query(
      'UPDATE articles SET files = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(updatedFiles), id]
    );

    res.json({
      message: 'Файл успешно удален',
      remainingFiles: updatedFiles.length
    });
  } catch (error) {
    console.error('Ошибка удаления файла:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Удалить конкретное изображение из статьи
router.delete('/:id/images/:imageId', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { id, imageId } = req.params;
    conn = await getConnection();

    // Получаем текущую статью
    const articles = await conn.query(
      'SELECT * FROM articles WHERE id = ?',
      [id]
    );

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const article = processArticleDates(articles[0]);
    const currentImages = article.images || [];

    // Фильтруем изображения, удаляя указанное
    const updatedImages = currentImages.filter(image => image.id !== imageId);

    // Обновляем статью
    await conn.query(
      'UPDATE articles SET images = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(updatedImages), id]
    );

    res.json({
      message: 'Изображение успешно удалено',
      remainingImages: updatedImages.length
    });
  } catch (error) {
    console.error('Ошибка удаления изображения:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});


// Принудительная очистка файлов статьи (админ)
router.delete('/:id/cleanup-files', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await getConnection();

    // Получаем статью
    const articles = await conn.query(
      'SELECT * FROM articles WHERE id = ?',
      [id]
    );

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const article = processArticleDates(articles[0]);

    // Удаляем файлы
    const cleanupResult = await deleteArticleFiles(article);

    res.json({
      message: 'Очистка файлов завершена',
      articleId: id,
      cleanupResult
    });

  } catch (error) {
    console.error('Ошибка очистки файлов:', error);
    res.status(500).json({
      error: 'Ошибка при очистке файлов',
      details: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

// Получить информацию о конкретном файле
router.get('/:id/files/:fileId', async (req, res) => {
  let conn;
  try {
    const { id, fileId } = req.params;
    conn = await getConnection();

    const articles = await conn.query(
      'SELECT files FROM articles WHERE id = ?',
      [id]
    );

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const files = safeJSONParse(articles[0].files);
    const file = files.find(f => f.id === fileId);

    if (!file) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    // Возвращаем информацию о файле (без данных base64 для экономии трафика)
    res.json({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: file.uploadedAt
    });
  } catch (error) {
    console.error('Ошибка получения информации о файле:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Получить информацию о конкретном изображении
router.get('/:id/images/:imageId', async (req, res) => {
  let conn;
  try {
    const { id, imageId } = req.params;
    conn = await getConnection();

    const articles = await conn.query(
      'SELECT images FROM articles WHERE id = ?',
      [id]
    );

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const images = safeJSONParse(articles[0].images);
    const image = images.find(img => img.id === imageId);

    if (!image) {
      return res.status(404).json({ error: 'Изображение не найдено' });
    }

    // Возвращаем информацию об изображении (без данных base64 для экономии трафика)
    res.json({
      id: image.id,
      name: image.name,
      type: image.type,
      uploadedAt: image.uploadedAt
    });
  } catch (error) {
    console.error('Ошибка получения информации об изображении:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Загрузить данные файла (base64)
router.get('/:id/files/:fileId/download', async (req, res) => {
  let conn;
  try {
    const { id, fileId } = req.params;
    conn = await getConnection();

    const articles = await conn.query(
      'SELECT files FROM articles WHERE id = ?',
      [id]
    );

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const files = safeJSONParse(articles[0].files);
    const file = files.find(f => f.id === fileId);

    if (!file) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    // Возвращаем полные данные файла
    res.json({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      data: file.data,
      uploadedAt: file.uploadedAt
    });
  } catch (error) {
    console.error('Ошибка получения файла:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Загрузить данные изображения (base64)
router.get('/:id/images/:imageId/download', async (req, res) => {
  let conn;
  try {
    const { id, imageId } = req.params;
    conn = await getConnection();

    const articles = await conn.query(
      'SELECT images FROM articles WHERE id = ?',
      [id]
    );

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const images = safeJSONParse(articles[0].images);
    const image = images.find(img => img.id === imageId);

    if (!image) {
      return res.status(404).json({ error: 'Изображение не найдено' });
    }

    // Возвращаем полные данные изображения
    res.json({
      id: image.id,
      name: image.name,
      type: image.type,
      data: image.data,
      uploadedAt: image.uploadedAt
    });
  } catch (error) {
    console.error('Ошибка получения изображения:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Удалить статью (только для администраторов) с удалением файлов
router.delete('/:id', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await getConnection();

    // Получаем статью со всеми данными
    const articles = await conn.query(
      'SELECT * FROM articles WHERE id = ?',
      [id]
    );

    if (articles.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const article = processArticleDates(articles[0]);

    // Удаляем файлы изображений из папки uploads
    await deleteArticleFiles(article);

    // Удаляем статью из базы данных
    await conn.query('DELETE FROM articles WHERE id = ?', [id]);

    res.json({
      message: 'Статья успешно удалена',
      deletedFiles: true
    });
  } catch (error) {
    console.error('Ошибка удаления статьи:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      details: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

// Остальные маршруты (статистика, поиск и т.д.) остаются без изменений
// Получить статистику статей по категориям
router.get('/stats/categories', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const stats = await conn.query(`
      SELECT 
        c.id as category_id,
        c.name as category_name,
        COUNT(a.id) as article_count
      FROM categories c
      LEFT JOIN articles a ON c.id = a.category_id
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);

    // console.log('Статистика категорий:', stats);

    const statsObj = {};
    stats.forEach(stat => {
      statsObj[stat.category_id] = Number(stat.article_count);
    });

    res.json(statsObj);
  } catch (error) {
    console.error('Ошибка получения статистики категорий:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      details: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});



// Получить общую статистику для панели управления
router.get('/management/stats', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    // Общее количество статей
    const totalArticlesResult = await conn.query('SELECT COUNT(*) as count FROM articles');
    const totalArticles = Number(totalArticlesResult[0].count);

    // Количество категорий со статьями (активные категории)
    const activeCategoriesResult = await conn.query(`
      SELECT COUNT(DISTINCT category_id) as count 
      FROM articles 
      WHERE category_id IS NOT NULL
    `);
    const activeCategories = Number(activeCategoriesResult[0].count);

    // Общее количество категорий
    const totalCategoriesResult = await conn.query('SELECT COUNT(*) as count FROM categories');
    const totalCategories = Number(totalCategoriesResult[0].count);

    // Статьи с файлами
    const articlesWithFilesResult = await conn.query(`
      SELECT COUNT(*) as count 
      FROM articles 
      WHERE files IS NOT NULL AND files != '[]' AND files != ''
    `);
    const articlesWithFiles = Number(articlesWithFilesResult[0].count);

    // Статьи с изображениями
    const articlesWithImagesResult = await conn.query(`
      SELECT COUNT(*) as count 
      FROM articles 
      WHERE images IS NOT NULL AND images != '[]' AND images != ''
    `);
    const articlesWithImages = Number(articlesWithImagesResult[0].count);

    const stats = {
      totalArticles: totalArticles,
      activeCategories: activeCategories,
      totalCategories: totalCategories,
      articlesWithFiles: articlesWithFiles,
      articlesWithImages: articlesWithImages,
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    console.error('Ошибка получения общей статистики:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      details: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

// Поиск статей
// В вашем API роутере для статей
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q) {
      return res.json([]);
    }

    const articles = await Article.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } }
      ]
    })
      .populate('category', 'name')
      .limit(parseInt(limit))
      .select('title category')
      .sort({ createdAt: -1 });

    res.json(articles);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

// Быстрый поиск для автодополнения
router.get('/search/suggestions', async (req, res) => {
  let conn;
  try {
    const { q: searchQuery } = req.query;

    if (!searchQuery || searchQuery.trim() === '') {
      return res.json([]);
    }

    conn = await getConnection();

    const searchTerm = `%${searchQuery.trim()}%`;

    const suggestions = await conn.query(`
      SELECT 
        id,
        title,
        category_id,
        MATCH(title, content) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
      FROM articles 
      WHERE title LIKE ? OR content LIKE ?
      ORDER BY relevance DESC, created_at DESC
      LIMIT 5
    `, [searchQuery, searchTerm, searchTerm]);

    res.json(suggestions);
  } catch (error) {
    console.error('Ошибка поиска подсказок:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Простая статистика по категориям для Dashboard
router.get('/stats/categories/simple', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const stats = await conn.query(`
      SELECT category_id, COUNT(*) as count 
      FROM articles 
      WHERE category_id IS NOT NULL 
      GROUP BY category_id
    `);

    const statsObj = {};
    stats.forEach(item => {
      statsObj[item.category_id] = Number(item.count);
    });

    res.json(statsObj);
  } catch (error) {
    console.error('Ошибка получения простой статистики категорий:', error);
    // Возвращаем пустой объект вместо ошибки
    res.json({});
  } finally {
    if (conn) conn.release();
  }
});
// Простая статистика для управления категориями
router.get('/stats/simple', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    // Простой запрос для подсчета статей по категориям
    const stats = await conn.query(`
      SELECT category_id, COUNT(*) as count 
      FROM articles 
      WHERE category_id IS NOT NULL 
      GROUP BY category_id
    `);

    const statsObj = {};
    stats.forEach(item => {
      statsObj[item.category_id] = Number(item.count);
    });

    // Общее количество статей
    const totalArticlesResult = await conn.query('SELECT COUNT(*) as count FROM articles');
    const totalArticles = Number(totalArticlesResult[0].count);

    const result = {
      categoryStats: statsObj,
      totalArticles: totalArticles,
      activeCategories: stats.length
    };

    res.json(result);
  } catch (error) {
    console.error('Ошибка получения простой статистики:', error);
    // Возвращаем пустые данные вместо ошибки
    res.json({
      categoryStats: {},
      totalArticles: 0,
      activeCategories: 0
    });
  } finally {
    if (conn) conn.release();
  }
});

// Получить статистику просмотров для статьи
router.get('/:id/views', async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await getConnection();

    // Если используем отдельную таблицу для просмотров
    const viewStats = await conn.query(
      'SELECT view_count FROM article_views WHERE article_id = ?',
      [id]
    );

    let views = 0;

    if (viewStats.length > 0) {
      // Берем из отдельной таблицы
      views = Number(viewStats[0].view_count);
    } else {
      // Или пытаемся взять из основного столбца (если существует)
      const articles = await conn.query(
        'SELECT views FROM articles WHERE id = ?',
        [id]
      );

      if (articles.length > 0) {
        views = Number(articles[0].views) || 0;
      }
    }

    res.json({
      articleId: id,
      views: views
    });
  } catch (error) {
    console.error('Ошибка получения статистики просмотров:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Получить самые популярные статьи (по просмотрам)
router.get('/popular/top', async (req, res) => {
  let conn;
  try {
    const { limit = 5 } = req.query;
    conn = await getConnection();

    const popularArticles = await conn.query(`
      SELECT a.*, c.name as category_name, u.username as author_name,
             COALESCE(SUM(av.view_count), 0) as total_views
      FROM articles a 
      LEFT JOIN categories c ON a.category_id = c.id 
      LEFT JOIN users u ON a.created_by = u.id 
      LEFT JOIN article_views av ON a.id = av.article_id
      ORDER BY total_views DESC, a.created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);

    const processedArticles = popularArticles.map(processArticleDates);

    res.json(processedArticles);
  } catch (error) {
    console.error('Ошибка получения популярных статей:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Увеличить счетчик просмотров статьи (исправленная версия)
router.post('/:id/view', async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await getConnection();

    console.log(`Увеличиваем просмотры для статьи ${id}`); // Логируем

    // Проверяем существование статьи
    const existingArticle = await conn.query(
      'SELECT id FROM articles WHERE id = ?',
      [id]
    );

    if (existingArticle.length === 0) {
      console.log(`Статья ${id} не найдена`);
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    // Обновляем или создаем запись в таблице просмотров
    const result = await conn.query(`
      INSERT INTO article_views (article_id, view_count) 
      VALUES (?, 1) 
      ON DUPLICATE KEY UPDATE 
      view_count = view_count + 1, 
      last_viewed = CURRENT_TIMESTAMP
    `, [id]);

    console.log(`Результат обновления просмотров:`, result); // Логируем

    // Получаем текущее количество просмотров
    const viewStats = await conn.query(
      'SELECT view_count FROM article_views WHERE article_id = ?',
      [id]
    );

    console.log(`Статистика просмотров:`, viewStats); // Логируем

    const views = viewStats.length > 0 ? viewStats[0].view_count : 1;

    res.json({
      articleId: id,
      views: Number(views),
      message: 'Счетчик просмотров обновлен'
    });
  } catch (error) {
    console.error('Ошибка обновления просмотров:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      details: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});


// Утилита для поиска неиспользуемых файлов
router.get('/utils/unused-files', optionalAuth, isAdmin, async (req, res) => {
  try {
    // Получаем все статьи из базы
    let conn = await getConnection();
    const articles = await conn.query('SELECT id, content, images, files FROM articles');
    conn.release();

    // Собираем все используемые имена файлов
    const usedFilenames = new Set();

    articles.forEach(article => {
      const processedArticle = processArticleDates(article);

      // Извлекаем файлы из контента
      const contentFiles = extractImageFilenamesFromContent(processedArticle.content);
      contentFiles.forEach(filename => usedFilenames.add(filename));

      // Файлы из поля images
      if (processedArticle.images && Array.isArray(processedArticle.images)) {
        processedArticle.images.forEach(image => {
          if (image.filename) usedFilenames.add(image.filename);
          if (image.filePath) usedFilenames.add(path.basename(image.filePath));
        });
      }

      // Файлы из поля files
      if (processedArticle.files && Array.isArray(processedArticle.files)) {
        processedArticle.files.forEach(file => {
          if (file.filename) usedFilenames.add(file.filename);
          if (file.filePath) usedFilenames.add(path.basename(file.filePath));
        });
      }
    });

    // Получаем все файлы в папке uploads
    const allFiles = fs.existsSync(uploadsPath)
      ? fs.readdirSync(uploadsPath).filter(file =>
        fs.statSync(path.join(uploadsPath, file)).isFile()
      )
      : [];

    // Находим неиспользуемые файлы
    const unusedFiles = allFiles.filter(file => !usedFilenames.has(file));

    res.json({
      totalFiles: allFiles.length,
      usedFiles: usedFilenames.size,
      unusedFiles: unusedFiles.length,
      unusedFilesList: unusedFiles,
      usedFilesList: Array.from(usedFilenames)
    });

  } catch (error) {
    console.error('Ошибка поиска неиспользуемых файлов:', error);
    res.status(500).json({
      error: 'Ошибка при поиске неиспользуемых файлов',
      details: error.message
    });
  }
});

// Удаление неиспользуемых файлов
router.delete('/utils/cleanup-unused-files', optionalAuth, isAdmin, async (req, res) => {
  try {
    // Получаем список неиспользуемых файлов
    const unusedResponse = await new Promise((resolve) => {
      const mockReq = { method: 'GET' };
      const mockRes = {
        json: (data) => resolve(data)
      };
      // Вызываем маршрут unused-files программно
      router.handle(mockReq, mockRes, () => { });
    });

    const { unusedFilesList } = unusedResponse;
    const deletionResults = [];

    // Удаляем каждый неиспользуемый файл
    for (const filename of unusedFilesList) {
      const filePath = path.join(uploadsPath, filename);
      const result = await safeDeleteFile(filePath);
      deletionResults.push({
        filename,
        success: result.success,
        message: result.message || result.error
      });
    }

    const successfulDeletions = deletionResults.filter(r => r.success).length;
    const failedDeletions = deletionResults.filter(r => !r.success).length;

    res.json({
      message: 'Очистка неиспользуемых файлов завершена',
      totalUnusedFiles: unusedFilesList.length,
      successfulDeletions,
      failedDeletions,
      details: deletionResults
    });

  } catch (error) {
    console.error('Ошибка очистки неиспользуемых файлов:', error);
    res.status(500).json({
      error: 'Ошибка при очистке неиспользуемых файлов',
      details: error.message
    });
  }
});

export default router;