import express from 'express';
import { optionalAuth, requireAuth, isAdmin } from '../middleware/auth.js';
import { getConnection } from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Настройка multer — оставляем как есть (для TinyMCE)
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'file' && !file.mimetype.startsWith('image/')) {
    return cb(new Error('Разрешены только изображения'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});
// Вспомогательные функции (оставляем без изменений)
const convertBigIntToNumber = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
  if (typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = convertBigIntToNumber(obj[key]);
    }
    return newObj;
  }
  return obj;
};

const safeJSONParse = (data) => {
  if (!data) return [];
  try {
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (e) {
    console.error('JSON parse error:', e);
    return [];
  }
};

const safeDateConvert = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date.toISOString();
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

// Вариант 1: Разрешить загрузку без авторизации (для изображений)
router.post('/tinymce/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('TinyMCE upload request received:', {
      file: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : 'no file'
    });

    // Проверяем, что файл был загружен
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({
        error: 'Файл не был загружен',
        details: 'Ожидается файл с именем поля "file"'
      });
    }

    const file = req.file;

    // Проверка типа файла
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        error: 'Разрешены только изображения',
        received: file.mimetype
      });
    }

    // Проверка размера файла
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        error: 'Размер файла не должен превышать 5MB',
        received: `${(file.size / 1024 / 1024).toFixed(2)}MB`
      });
    }

    // Конвертируем buffer в base64
    const base64Data = file.buffer.toString('base64');
    const base64String = `data:${file.mimetype};base64,${base64Data}`;

    console.log('Image uploaded successfully:', {
      name: file.originalname,
      type: file.mimetype,
      size: file.size
    });

    // Возвращаем ответ в формате, ожидаемом TinyMCE
    res.json({
      location: base64String
    });

  } catch (error) {
    console.error('Ошибка загрузки изображения TinyMCE:', error);
    res.status(500).json({
      error: 'Ошибка загрузки изображения',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
// router.post('/', optionalAuth, isAdmin, async (req, res) => {
//   let conn;
//   try {
//     const { title, content, category_id, files, images } = req.body;
//     conn = await getConnection();

//     // Process files and images (store as base64 in database)
//     const processedFiles = files ? files.map(file => ({
//       id: uuidv4(),
//       name: file.name,
//       type: file.type,
//       size: file.size,
//       data: file.data, // base64 encoded
//       uploadedAt: new Date().toISOString()
//     })) : [];

//     const processedImages = images ? images.map(image => ({
//       id: uuidv4(),
//       name: image.name,
//       type: image.type,
//       data: image.data, // base64 encoded
//       uploadedAt: new Date().toISOString()
//     })) : [];

//     const result = await conn.query(
//       `INSERT INTO articles (title, content, category_id, created_by, files, images) 
//        VALUES (?, ?, ?, ?, ?, ?)`,
//       [
//         title,
//         content,
//         category_id,
//         req.user.userId,
//         JSON.stringify(processedFiles),
//         JSON.stringify(processedImages)
//       ]
//     );

//     // Получаем созданную статью с обработкой JSON
//     const newArticles = await conn.query(`
//       SELECT a.*, c.name as category_name, u.username as author_name 
//       FROM articles a 
//       LEFT JOIN categories c ON a.category_id = c.id 
//       LEFT JOIN users u ON a.created_by = u.id 
//       WHERE a.id = ?
//     `, [result.insertId]);

//     const processedArticle = processArticleDates(newArticles[0]);

//     res.status(201).json({
//       ...processedArticle,
//       message: 'Статья успешно создана'
//     });
//   } catch (error) {
//     console.error('Ошибка создания статьи:', error);
//     res.status(500).json({ error: 'Внутренняя ошибка сервера' });
//   } finally {
//     if (conn) conn.release();
//   }
// });

router.post('/', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { title, content, category_id, files, images } = req.body;
    conn = await getConnection();

    // Явная проверка обязательных полей
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Название статьи обязательно' });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Содержание статьи обязательно' });
    }
    if (!category_id) {
      return res.status(400).json({ error: 'Категория обязательна' });
    }

    // Проверка аутентификации
    if (!req.user || !req.user.userId) {
      console.warn('Попытка создания статьи без userId:', req.user);
      return res.status(403).json({ error: 'Доступ запрещён: пользователь не авторизован' });
    }

    const userId = Number(req.user.userId);
    if (isNaN(userId)) {
      return res.status(403).json({ error: 'Некорректный идентификатор пользователя' });
    }

    // Обработка files
    let processedFiles = [];
    if (files && Array.isArray(files)) {
      processedFiles = files.map(file => {
        if (!file.name || !file.type || !file.data) {
          console.warn('Пропущен некорректный файл:', file);
          return null;
        }
        return {
          id: file.id || uuidv4(),
          name: file.name,
          type: file.type,
          size: file.size || 0,
          data: file.data,
          uploadedAt: new Date().toISOString()
        };
      }).filter(Boolean);
    }

    // Обработка images
    let processedImages = [];
    if (images && Array.isArray(images)) {
      processedImages = images.map(image => {
        if (!image.name || !image.type || !image.data) {
          console.warn('Пропущено некорректное изображение:', image);
          return null;
        }
        return {
          id: image.id || uuidv4(),
          name: image.name,
          type: image.type,
          data: image.data,
          uploadedAt: new Date().toISOString()
        };
      }).filter(Boolean);
    }

    conn = await getConnection();
    if (!conn) {
      console.error('Не удалось получить соединение с БД');
      return res.status(500).json({ error: 'Сервис временно недоступен' });
    }

    // Вставка статьи
    const result = await conn.query(
      `INSERT INTO articles (title, content, category_id, created_by, files, images) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        content.trim(),
        Number(category_id),
        userId,
        JSON.stringify(processedFiles),
        JSON.stringify(processedImages)
      ]
    );

    // Получение созданной статьи
    const [newArticle] = await conn.query(`
      SELECT a.*, c.name as category_name, u.username as author_name 
      FROM articles a 
      LEFT JOIN categories c ON a.category_id = c.id 
      LEFT JOIN users u ON a.created_by = u.id 
      WHERE a.id = ?
    `, [result.insertId]);

    if (!newArticle) {
      return res.status(500).json({ error: 'Статья создана, но не найдена' });
    }

    const processedArticle = processArticleDates(newArticle);

    res.status(201).json({
      ...processedArticle,
      message: 'Статья успешно создана'
    });

  } catch (error) {
    // Логируем полную ошибку только на сервере
    console.error('FATAL: Ошибка создания статьи:', {
      message: error.message,
      stack: error.stack,
      body: req.body ? {
        title: typeof req.body.title,
        content: typeof req.body.content,
        category_id: req.body.category_id,
        files: Array.isArray(req.body.files) ? req.body.files.length : 'отсутствуют',
        images: Array.isArray(req.body.images) ? req.body.images.length : 'отсутствуют',
        user: req.user
      } : 'нет данных'
    });

    // Возвращаем клиенту обобщённую ошибку
    res.status(500).json({
      error: 'Не удалось создать статью. Повторите попытку позже.',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
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
      imagesToRemove = []
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
       SET title = ?, content = ?, category_id = ?, files = ?, images = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [
        title.trim(),
        content.trim(),
        category_id,
        JSON.stringify(updatedFiles),
        JSON.stringify(updatedImages),
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

// Удалить статью (только для администраторов)
router.delete('/:id', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await getConnection();

    // Проверяем существование статьи
    const existingArticle = await conn.query(
      'SELECT * FROM articles WHERE id = ?',
      [id]
    );

    if (existingArticle.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    // Удаляем статью
    await conn.query('DELETE FROM articles WHERE id = ?', [id]);

    res.json({ message: 'Статья успешно удалена' });
  } catch (error) {
    console.error('Ошибка удаления статьи:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
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
router.get('/search', async (req, res) => {
  let conn;
  try {
    const { q: searchQuery, category, page = 1, limit = 10 } = req.query;

    if (!searchQuery || searchQuery.trim() === '') {
      return res.status(400).json({ error: 'Поисковый запрос не может быть пустым' });
    }

    conn = await getConnection();

    const offset = (page - 1) * limit;
    const searchTerm = `%${searchQuery.trim()}%`;

    let whereClause = `(a.title LIKE ? OR a.content LIKE ?)`;
    let queryParams = [searchTerm, searchTerm];

    if (category && category !== 'all') {
      whereClause += ` AND a.category_id = ?`;
      queryParams.push(category);
    }

    const articles = await conn.query(`
      SELECT a.*, c.name as category_name, u.username as author_name 
      FROM articles a 
      LEFT JOIN categories c ON a.category_id = c.id 
      LEFT JOIN users u ON a.created_by = u.id 
      WHERE ${whereClause}
      ORDER BY 
        CASE 
          WHEN a.title LIKE ? THEN 1 
          WHEN a.content LIKE ? THEN 2 
          ELSE 3 
        END,
        a.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, searchTerm, searchTerm, parseInt(limit), offset]);

    const countResult = await conn.query(`
      SELECT COUNT(*) as total 
      FROM articles a 
      WHERE ${whereClause}
    `, queryParams);

    const totalArticles = Number(countResult[0].total);
    const totalPages = Math.ceil(totalArticles / limit);

    const processedArticles = articles.map(processArticleDates);

    res.json({
      articles: processedArticles,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalArticles,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      searchInfo: {
        query: searchQuery,
        category: category || 'all',
        resultsCount: articles.length
      }
    });
  } catch (error) {
    console.error('Ошибка поиска статей:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
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

export default router;