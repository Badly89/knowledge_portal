import express from 'express';
import { optionalAuth, requireAuth, isAdmin } from '../middleware/auth.js';
import { getConnection } from '../utils/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

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
// Создать статью (только для администраторов)
router.post('/', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { title, content, category_id, files, images } = req.body;
    conn = await getConnection();

    // Обработка файлов и изображений (храним как base64 в базе данных)
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

    const processedArticle = {
      ...articles[0],
      files: safeJSONParse(articles[0].files),
      images: safeJSONParse(articles[0].images)
    };


    // res.json(articles[0]);
  } catch (error) {
    console.error('Ошибка получения статьи:', error);
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

    console.log('Статистика категорий:', stats); // Добавим лог для отладки

    const statsObj = {};
    stats.forEach(stat => {
      statsObj[stat.category_id] = parseInt(stat.article_count);
    });

    res.json(statsObj);

    res.json(statsObj);
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
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
    const totalArticles = await conn.query('SELECT COUNT(*) as count FROM articles');

    // Количество категорий со статьями (активные категории)
    const activeCategories = await conn.query(`
      SELECT COUNT(DISTINCT category_id) as count 
      FROM articles 
      WHERE category_id IS NOT NULL
    `);

    // Общее количество категорий
    const totalCategories = await conn.query('SELECT COUNT(*) as count FROM categories');

    // Последние созданные статьи
    const recentArticles = await conn.query(`
      SELECT title, created_at 
      FROM articles 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    res.json({
      totalArticles: totalArticles[0].count,
      activeCategories: activeCategories[0].count,
      totalCategories: totalCategories[0].count,
      recentArticlesCount: recentArticles.length
    });
  } catch (error) {
    console.error('Ошибка получения общей статистики:', error);
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
  } catch (error) {
    console.error('Ошибка получения статьи:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

export default router;