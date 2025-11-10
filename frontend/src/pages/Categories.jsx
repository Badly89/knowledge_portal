import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import '../styles/Categories.css'; // Импортируем CSS файл

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
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Загрузка категорий...</p>
      </div>
    );
  }

  return (
    <div className="categories-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Категории статей</h1>
        </div>
        {isAuthenticated && user?.role === 'admin' && (
          <Link to="/categories/manage" className="btn-admin">
            <span className="btn-icon">⚙️</span>
            Управление категориями
          </Link>
        )}
      </div>

      <div className="categories-container">
        {categories.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>Категории отсутствуют</h3>
            <p>Здесь пока нет ни одной категории статей</p>
            {isAuthenticated && user?.role === 'admin' && (
              <Link to="/categories/manage" className="btn-primary">
                Создать первую категорию
              </Link>
            )}
          </div>
        ) : (
          <div className="categories-grid">
            {categories.map(category => (
              <Link
                key={category.id}
                to={`/articles?category=${category.id}`}
                className="btn-explore"
              >
                <div className="category-card">

                  <div className="card-content">
                    <h3 className="category-title">{category.name}</h3>
                    {category.description && (
                      <p className="category-description">{category.description}</p>
                    )}
                  </div>
                  <div className="card-hover-effect"></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Categories;