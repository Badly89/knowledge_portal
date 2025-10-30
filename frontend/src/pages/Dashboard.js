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
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    fetchDashboardData();
    fetchCategories();
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

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
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
          Единая база знаний Администрации города Ноябрьска
        </h1>
        <p>
          {isAuthenticated
            ? `С возвращением, ${user?.username}!`
            : 'Добро пожаловать в нашу Базу Знаний! Просматривайте статьи и категории.'
          }
        </p>

      </div>

      <div className="dashboard-main-content">
        {/* Центральная часть - Категории */}
        <div className="categories-center-section">
          <div className="section-header">
            <h2>
              <i className="fas fa-folder-open me-2"></i>
              Категории статей
            </h2>
            <p>Выберите категорию для просмотра статей</p>
          </div>

          {categories.length === 0 ? (
            <div className="no-categories-center">
              <i className="fas fa-folder-open fa-3x mb-3"></i>
              <h3>Категории отсутствуют</h3>
              <p>Пока нет созданных категорий</p>
              {isAuthenticated && user?.role === 'admin' && (
                <Link to="/categories/manage" className="btn-primary">
                  <i className="fas fa-plus me-1"></i>
                  Создать категории
                </Link>
              )}
            </div>
          ) : (
            <div className="categories-grid-center">
              {categories.map(category => (
                <Link
                  key={category.id}
                  to={`/articles?category=${category.id}`}
                  className="category-card-center"
                >
                  <div className="category-icon">
                    <i className="fas fa-folder"></i>
                  </div>
                  <div className="category-content">
                    <h3 className="category-name">{category.name}</h3>
                    {category.description && (
                      <p className="category-description">{category.description}</p>
                    )}
                    <div className="category-meta">
                      <span className="article-count">
                        <i className="fas fa-file me-1"></i>
                        Статей: {category.article_count || 0}
                      </span>
                    </div>
                  </div>
                  <div className="category-arrow">
                    <i className="fas fa-chevron-right"></i>
                  </div>
                </Link>
              ))}
            </div>
          )}


        </div>

        {/* Правая часть - Быстрые действия */}
        <div className="quick-actions-sidebar">
          <div className="sidebar-section">
            <h3>
              <i className="fas fa-bolt me-2"></i>
              Быстрые действия
            </h3>
            <div className="action-buttons-vertical">
              <Link to="/articles" className="action-btn">
                <i className="fas fa-book-open me-2"></i>
                <span>Просмотр статей</span>
              </Link>

              <Link to="/categories" className="action-btn">
                <i className="fas fa-folder me-2"></i>
                <span>Все категории</span>
              </Link>

              <Link to="/search" className="action-btn">
                <i className="fas fa-search me-2"></i>
                <span>Поиск статей</span>
              </Link>



              {/* Функционал администратора */}
              {isAuthenticated && user?.role === 'admin' && (
                <>
                  <div className="admin-section">
                    <h4>
                      <i className="fas fa-crown me-2"></i>
                      Панель администратора
                    </h4>

                    <Link to="/articles/create" className="action-btn admin">
                      <i className="fas fa-plus-circle me-2"></i>
                      <span>Создать статью</span>
                    </Link>

                    <Link to="/articles/manage" className="action-btn admin">
                      <i className="fas fa-edit me-2"></i>
                      <span>Управление статьями</span>
                    </Link>

                    <Link to="/categories/manage" className="action-btn admin">
                      <i className="fas fa-cog me-2"></i>
                      <span>Управление категориями</span>
                    </Link>

                    <div className="admin-stats">
                      <div className="admin-stat">
                        <i className="fas fa-chart-bar me-2"></i>
                        <span>Статистика системы</span>
                      </div>
                      <div className="stat-numbers">
                        <div className="stat-item">
                          <strong>{stats.totalArticles}</strong>
                          <span>статей</span>
                        </div>
                        <div className="stat-item">
                          <strong>{stats.totalCategories}</strong>
                          <span>категорий</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}


            </div>
          </div>

          {/* Быстрые ссылки */}
          <div className="sidebar-section">
            <h3>
              <i className="fas fa-link me-2"></i>
              Быстрые ссылки
            </h3>
            <div className="quick-links">
              <Link to="/articles?sort=recent" className="quick-link">
                <i className="fas fa-fire me-2"></i>
                Новые статьи
              </Link>
              <Link to="/articles?sort=popular" className="quick-link">
                <i className="fas fa-star me-2"></i>
                Популярные
              </Link>
              <Link to="/help" className="quick-link">
                <i className="fas fa-question-circle me-2"></i>
                Помощь
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;