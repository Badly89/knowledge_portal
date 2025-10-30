import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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
    return <div className="dashboard-loading">Загрузка главной страницы...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Портал Базы Знаний</h1>
        <p>
          {isAuthenticated
            ? `С возвращением, ${user?.username}!`
            : 'Добро пожаловать, путешественник!'
          }
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <h3>Всего статей</h3>
            <p className="stat-number">{stats.totalArticles}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <h3>Категории</h3>
            <p className="stat-number">{stats.totalCategories}</p>
          </div>
        </div>


      </div>

      <div className="dashboard-sections">
        <div className="recent-articles">
          <div className="section-header">
            <h2>Последние статьи</h2>
            <Link to="/articles" className="view-all-link">Все статьи</Link>
          </div>

          {stats.recentArticles.length === 0 ? (
            <div className="no-data">
              <p>Статьи пока отсутствуют.</p>
              {isAuthenticated && user?.role === 'admin' && (
                <Link to="/articles/create" className="create-link">
                  Создать первую статью
                </Link>
              )}
            </div>
          ) : (
            <div className="articles-list">
              {stats.recentArticles.map(article => (
                <div key={article.id} className="article-item">
                  <Link
                    to={`/articles/${article.id}`}
                    className="read-link"
                  >
                    <div className="article-main">
                      <h4 className="article-title">{article.title}</h4>
                      <p className="article-meta">
                        в <span className="category">{article.category_name}</span> •
                        автор: {article.author_name} •
                        {new Date(article.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    {/* <div className="article-actions"> */}

                    {/* Читать */}
                  </Link>
                  {/* </div> */}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="quick-actions">
          <h2>Быстрые действия</h2>
          <div className="action-buttons">
            <Link to="/articles" className="action-button">
              <span className="action-icon">📖</span>
              <span>Просмотр статей</span>
            </Link>

            <Link to="/categories" className="action-button">
              <span className="action-icon">📂</span>
              <span>Просмотр категорий</span>
            </Link>

            {isAuthenticated && user?.role === 'admin' && (
              <>
                <Link to="/articles/create" className="action-button">
                  <span className="action-icon">✏️</span>
                  <span>Создать статью</span>
                </Link>

                <button className="action-button" onClick={() => alert('Управление категориями скоро будет доступно!')}>
                  <span className="action-icon">➕</span>
                  <span>Управление категориями</span>
                </button>
              </>
            )}


          </div>
        </div>
      </div>
    </div >
  );
}

export default Dashboard;