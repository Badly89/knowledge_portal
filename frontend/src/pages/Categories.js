import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка категорий...</div>;
  }

  return (
    <div className="categories-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Категории статей</h1>
          <p>Просматривайте статьи по категориям для удобного поиска информации</p>
        </div>
        {isAuthenticated && user?.role === 'admin' && (
          <Link to="/categories/manage" className="btn-primary">
            ⚙️ Управление категориями
          </Link>
        )}
      </div>

      <div className="categories-grid-view">
        {categories.length === 0 ? (
          <div className="no-categories">
            <p>Категории отсутствуют.</p>
            {isAuthenticated && user?.role === 'admin' && (
              <Link to="/categories/manage" className="btn-primary">
                Создать категории
              </Link>
            )}
          </div>
        ) : (
          categories.map(category => (
            <div key={category.id} className="category-card-view">
              <div className="category-content">
                <h3 className="category-name">{category.name}</h3>
                {category.description && (
                  <p className="category-description">{category.description}</p>
                )}
                <div className="category-meta">
                  <span>Статей в категории</span>
                  <span>Создано: {new Date(category.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
              <div className="category-actions">
                <Link
                  to={`/articles?category=${category.id}`}
                  className="btn-view-category"
                >
                  📖 Смотреть статьи
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Categories;