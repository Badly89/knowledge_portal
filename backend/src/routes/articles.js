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

    // Обрабатываем JSON поля
    const processedArticles = articles.map(article => ({
      ...article,
      files: safeJSONParse(article.files),
      images: safeJSONParse(article.images)
    }));

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

    // Обрабатываем JSON поля
    const processedArticle = {
      ...articles[0],
      files: safeJSONParse(articles[0].files),
      images: safeJSONParse(articles[0].images)
    };

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

    // Обрабатываем JSON поля
    const processedArticle = {
      ...articles[0],
      files: safeJSONParse(articles[0].files),
      images: safeJSONParse(articles[0].images)
    };

    res.json(processedArticle);
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
      data: file.data // base64 encoded
    })) : [];

    const processedImages = images ? images.map(image => ({
      id: uuidv4(),
      name: image.name,
      type: image.type,
      data: image.data // base64 encoded
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

    const processedArticle = {
      ...newArticles[0],
      files: safeJSONParse(newArticles[0].files),
      images: safeJSONParse(newArticles[0].images)
    };

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

// Обновить статью (только для администраторов)
router.put('/:id', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { title, content, category_id, files, images } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Название статьи обязательно' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Содержание статьи обязательно' });
    }

    conn = await getConnection();

    // Проверяем существование статьи
    const existingArticle = await conn.query(
      'SELECT * FROM articles WHERE id = ?',
      [id]
    );

    if (existingArticle.length === 0) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    // Обработка файлов и изображений
    const processedFiles = files ? files.map(file => ({
      id: file.id || uuidv4(),
      name: file.name,
      type: file.type,
      size: file.size,
      data: file.data
    })) : [];

    const processedImages = images ? images.map(image => ({
      id: image.id || uuidv4(),
      name: image.name,
      type: image.type,
      data: image.data
    })) : [];

    // Обновляем статью
    await conn.query(
      `UPDATE articles 
       SET title = ?, content = ?, category_id = ?, files = ?, images = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [
        title.trim(),
        content.trim(),
        category_id,
        JSON.stringify(processedFiles),
        JSON.stringify(processedImages),
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

    const processedArticle = {
      ...updatedArticles[0],
      files: safeJSONParse(updatedArticles[0].files),
      images: safeJSONParse(updatedArticles[0].images)
    };

    res.json({
      ...processedArticle,
      message: 'Статья успешно обновлена'
    });
  } catch (error) {
    console.error('Ошибка обновления статьи:', error);
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

// Получить статистику статей по категориям
router.get('/stats/categories', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    // Получаем количество статей для каждой категории
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

    // Преобразуем в объект для удобства
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