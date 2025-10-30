import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getConnection } from '../utils/database.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Вход в систему
router.post('/login', async (req, res) => {
  let conn;
  try {
    const { username, password } = req.body;
    conn = await getConnection();

    const user = await conn.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (user.length === 0) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const isValidPassword = await bcrypt.compare(password, user[0].password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const token = jwt.sign(
      { userId: user[0].id, username: user[0].username, role: user[0].role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user[0].id,
        username: user[0].username,
        email: user[0].email,
        role: user[0].role
      }
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    if (conn) conn.release();
  }
});

// Получить информацию о текущем пользователе
router.get('/me', async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.json({ user: null });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    let conn;
    try {
      conn = await getConnection();
      const user = await conn.query(
        'SELECT id, username, email, role FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (user.length === 0) {
        return res.json({ user: null });
      }

      res.json({ user: user[0] });
    } catch (error) {
      console.error('Ошибка получения пользователя:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    } finally {
      if (conn) conn.release();
    }
  } catch (error) {
    res.json({ user: null });
  }
});

export default router;