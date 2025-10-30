import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

function Dashboard() {
  const [stats, setStats] = useState({
    totalArticles: 0,
    totalCategories: 0,
    recentArticles: []
  });
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [articlesRes, categoriesRes] = await Promise.all([
        axios.get('/api/articles'),
        axios.get('/api/categories')
      ]);

      const recentArticles = articlesRes.data.slice(0, 5);

      setStats({
        totalArticles: articlesRes.data.length,
        totalCategories: categoriesRes.data.length,
        recentArticles
      });
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <i className="fas fa-spinner fa-spin me-2"></i>
        Загрузка главной страницы...
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>
          <i className="fas fa-book-open me-2"></i>
          Портал Базы Знаний
        </h1>
        <p>
          {isAuthenticated
            ? `С возвращением, ${user?.username}!`
            : 'Добро пожаловать в нашу Базу Знаний! Просматривайте статьи и категории.'
          }
        </p>

      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-book"></i>
          </div>
          <div className="stat-info">
            <h3>Всего статей</h3>
            <p className="stat-number">{stats.totalArticles}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-folder"></i>
          </div>
          <div className="stat-info">
            <h3>Категории</h3>
            <p className="stat-number">{stats.totalCategories}</p>
          </div>
        </div>


      </div>

      <div className="dashboard-sections">
        <div className="recent-articles">
          <div className="section-header">
            <h2>
              <i className="fas fa-clock me-2"></i>
              Последние статьи
            </h2>
            <Link to="/articles" className="view-all-link">
              <i className="fas fa-list me-1"></i>
              Все статьи
            </Link>
          </div>

          {stats.recentArticles.length === 0 ? (
            <div className="no-data">
              <i className="fas fa-inbox fa-2x mb-2"></i>
              <p>Статьи пока отсутствуют.</p>
              {isAuthenticated && user?.role === 'admin' && (
                <Link to="/articles/create" className="create-link">
                  <i className="fas fa-plus me-1"></i>
                  Создать первую статью
                </Link>
              )}
            </div>
          ) : (
            <div className="articles-list">
              {stats.recentArticles.map(article => (
                <div key={article.id} className="article-item">
                  <div className="article-main">
                    <h4 className="article-title">{article.title}</h4>
                    <p className="article-meta">
                      <i className="fas fa-folder me-1"></i>
                      в <span className="category">{article.category_name}</span> •
                      <i className="fas fa-user me-1 ms-2"></i>
                      автор: {article.author_name} •
                      <i className="fas fa-calendar me-1 ms-2"></i>
                      {new Date(article.created_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="article-actions">
                    <Link
                      to={`/articles/${article.id}`}
                      className="read-link"
                    >
                      <i className="fas fa-eye me-1"></i>
                      Читать
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="quick-actions">
          <h2>
            <i className="fas fa-bolt me-2"></i>
            Быстрые действия
          </h2>
          <div className="action-buttons">
            <Link to="/articles" className="action-button">
              <i className="fas fa-book-open me-2"></i>
              <span>Просмотр статей</span>
            </Link>

            <Link to="/categories" className="action-button">
              <i className="fas fa-folder me-2"></i>
              <span>Просмотр категорий</span>
            </Link>

            {isAuthenticated && user?.role === 'admin' && (
              <>
                <Link to="/articles/create" className="action-button">
                  <i className="fas fa-edit me-2"></i>
                  <span>Создать статью</span>
                </Link>

                <Link to="/categories/manage" className="action-button">
                  <i className="fas fa-cog me-2"></i>
                  <span>Управление категориями</span>
                </Link>
              </>
            )}

            {!isAuthenticated && (
              <Link to="/login" className="action-button">
                <i className="fas fa-sign-in-alt me-2"></i>
                <span>Войти для большего</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;