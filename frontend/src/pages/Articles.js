import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

function Articles() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);

  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await axios.get('/api/articles');
      setArticles(response.data);
    } catch (error) {
      console.error('Ошибка загрузки статей:', error);
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

  const filteredArticles = selectedCategory
    ? articles.filter(article => article.category_id == selectedCategory)
    : articles;

  const getArticleExcerpt = (content) => {
    return content.length > 150
      ? content.substring(0, 150) + '...'
      : content;
  };

  if (loading) {
    return <div className="loading">Загрузка статей...</div>;
  }

  return (
    <div className="articles-page">
      <div className="page-header">
        <h1>Статьи Базы Знаний</h1>
        {isAuthenticated && user?.role === 'admin' && (
          <Link to="/articles/create" className="btn-primary">
            Создать статью
          </Link>
        )}
      </div>

      <div className="articles-controls">
        <div className="filter-section">
          <label htmlFor="category-filter">Фильтр по категории:</label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Все категории</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="articles-count">
          Показано {filteredArticles.length} из {articles.length} статей
        </div>
      </div>

      <div className="articles-list">
        {filteredArticles.length === 0 ? (
          <div className="no-articles">
            <p>Статьи не найдены.</p>
            {isAuthenticated && user?.role === 'admin' && (
              <Link to="/articles/create" className="btn-primary">
                Создать первую статью
              </Link>
            )}
          </div>
        ) : (
          filteredArticles.map(article => (
            <article key={article.id} className="article-card">
              <div className="article-header">
                <h2 className="article-title">{article.title}</h2>
                <div className="article-meta">
                  <span className="category-badge">{article.category_name}</span>
                  <span className="author">Автор: {article.author_name}</span>
                  <span className="date">
                    {new Date(article.created_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>

              <div className="article-content">
                <p>{getArticleExcerpt(article.content)}</p>
              </div>

              <div className="article-footer">
                <div className="article-attachments">
                  {article.files && JSON.parse(article.files).length > 0 && (
                    <span className="attachments-count">
                      📎 {JSON.parse(article.files).length} файл(ов)
                    </span>
                  )}
                  {article.images && JSON.parse(article.images).length > 0 && (
                    <span className="images-count">
                      🖼️ {JSON.parse(article.images).length} изображений
                    </span>
                  )}
                </div>

                <div className="article-actions">
                  <Link
                    to={`/articles/${article.id}`}
                    className="read-more-btn"
                  >
                    Читать далее
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export default Articles;