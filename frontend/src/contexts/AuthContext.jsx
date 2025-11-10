import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// Переменные для отслеживания попыток входа (вне компонента, чтобы не сбрасывались при ререндере)
let loginAttempts = 0;
let lastAttemptTime = 0;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 60000; // 1 минута в миллисекундах

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');

      if (token && userData) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // Проверяем валидность токена на сервере
        const response = await axios.get('/api/auth/me');

        if (response.data.user) {
          setUser(response.data.user);
          setIsAuthenticated(true);
        } else {
          // Token is invalid
          cleanupAuth();
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      cleanupAuth();
    } finally {
      setLoading(false);
    }
  };

  const cleanupAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setIsAuthenticated(false);
  };

  const login = async (username, password) => {
    try {
      setLoading(true);
      setError('');

      const now = Date.now();
      const timeSinceLastAttempt = now - lastAttemptTime;

      // Сбрасываем счетчик если прошло больше времени окна
      if (timeSinceLastAttempt > ATTEMPT_WINDOW) {
        loginAttempts = 0;
      }

      // Проверяем лимит попыток
      if (loginAttempts >= MAX_ATTEMPTS) {
        const timeLeft = Math.ceil((ATTEMPT_WINDOW - timeSinceLastAttempt) / 1000);
        throw new Error(`Слишком много попыток входа. Попробуйте через ${timeLeft} секунд.`);
      }

      // Добавляем задержку между запросами
      if (loginAttempts > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      loginAttempts++;
      lastAttemptTime = now;

      const response = await axios.post('/api/auth/login', {
        username,
        password
      });

      const { token, user } = response.data;

      // Сбрасываем счетчик при успешном входе
      loginAttempts = 0;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      setIsAuthenticated(true);
      setError('');

      return { success: true };
    } catch (error) {
      let errorMessage = 'Ошибка входа';

      if (error.response?.status === 429) {
        errorMessage = 'Слишком много запросов. Подождите немного.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Сбрасываем счетчик попыток при выходе
    loginAttempts = 0;
    cleanupAuth();
  };

  const clearError = () => {
    setError('');
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    checkAuthStatus,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};