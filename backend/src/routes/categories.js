import express from 'express';
import { optionalAuth, isAdmin } from '../middleware/auth.js';
import { getConnection } from '../utils/database.js';

const router = express.Router();

// Получить все категории (публичный доступ)
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const categories = await conn.query(`
      SELECT c.*, u.username as created_by_name 
      FROM categories c 
      LEFT JOIN users u ON c.created_by = u.id 
      ORDER BY c.name
    `);
    res.json(categories);
  } catch (error) {
    console.error('Ошибка получения категорий:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Получить категорию по ID
router.get('/:id', async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await getConnection();

    const categories = await conn.query(`
      SELECT c.*, u.username as created_by_name 
      FROM categories c 
      LEFT JOIN users u ON c.created_by = u.id 
      WHERE c.id = ?
    `, [id]);

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }

    res.json(categories[0]);
  } catch (error) {
    console.error('Ошибка получения категории:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Создать категорию (только для администраторов)
router.post('/', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Название категории обязательно' });
    }

    conn = await getConnection();

    const result = await conn.query(
      'INSERT INTO categories (name, description, created_by) VALUES (?, ?, ?)',
      [name.trim(), description?.trim() || '', req.user.userId]
    );

    // Получаем созданную категорию с информацией о создателе
    const newCategory = await conn.query(`
      SELECT c.*, u.username as created_by_name 
      FROM categories c 
      LEFT JOIN users u ON c.created_by = u.id 
      WHERE c.id = ?
    `, [result.insertId]);

    res.status(201).json(newCategory[0]);
  } catch (error) {
    console.error('Ошибка создания категории:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Категория с таким названием уже существует' });
    } else {
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  } finally {
    if (conn) conn.release();
  }
});

// Обновить категорию (только для администраторов)
router.put('/:id', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Название категории обязательно' });
    }

    conn = await getConnection();

    // Проверяем существование категории
    const existingCategory = await conn.query(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );

    if (existingCategory.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }

    // Обновляем категорию
    await conn.query(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name.trim(), description?.trim() || '', id]
    );

    // Получаем обновленную категорию
    const updatedCategory = await conn.query(`
      SELECT c.*, u.username as created_by_name 
      FROM categories c 
      LEFT JOIN users u ON c.created_by = u.id 
      WHERE c.id = ?
    `, [id]);

    res.json(updatedCategory[0]);
  } catch (error) {
    console.error('Ошибка обновления категории:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Категория с таким названием уже существует' });
    } else {
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  } finally {
    if (conn) conn.release();
  }
});

// Удалить категорию (только для администраторов)
router.delete('/:id', optionalAuth, isAdmin, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await getConnection();

    // Проверяем существование категории
    const existingCategory = await conn.query(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );

    if (existingCategory.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }

    // Проверяем, есть ли статьи в этой категории
    const articlesInCategory = await conn.query(
      'SELECT COUNT(*) as count FROM articles WHERE category_id = ?',
      [id]
    );

    if (articlesInCategory[0].count > 0) {
      return res.status(400).json({
        error: 'Невозможно удалить категорию. В ней содержатся статьи.'
      });
    }

    // Удаляем категорию
    await conn.query('DELETE FROM categories WHERE id = ?', [id]);

    res.json({ message: 'Категория успешно удалена' });
  } catch (error) {
    console.error('Ошибка удаления категории:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

export default router;