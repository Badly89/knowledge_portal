import express from 'express';
import { optionalAuth, requireAuth, isAdmin } from '../middleware/auth.js';
import { getConnection } from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

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

// Получить все статьи с информацией о категориях (публичный доступ)
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const articles = await conn.query(`
      SELECT a.*, c.name as category_name, u.username as author_name 
      FROM articles a 
      LEFT JOIN categories c ON a.category_id = c.id 
      LEFT JOIN users u ON a.created_by = u.id 
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
    const { title, content, category_id, files, images } = req.body;
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
      `INSERT INTO articles (title, content, category_id, created_by, files, images) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title,
        content,
        category_id,
        req.user.userId,
        JSON.stringify(processedFiles),
        JSON.stringify(processedImages)
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

    console.log('Статистика категорий:', stats);

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

    // Добавляем фильтр по категории если указан
    if (category && category !== 'all') {
      whereClause += ` AND a.category_id = ?`;
      queryParams.push(category);
    }

    // Получаем статьи с пагинацией
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

    // Получаем общее количество для пагинации
    const countResult = await conn.query(`
      SELECT COUNT(*) as total 
      FROM articles a 
      WHERE ${whereClause}
    `, queryParams);

    const totalArticles = countResult[0].total;
    const totalPages = Math.ceil(totalArticles / limit);

    // Обрабатываем JSON поля
    const processedArticles = articles.map(article => ({
      ...article,
      files: safeJSONParse(article.files),
      images: safeJSONParse(article.images)
    }));

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

export default router;