import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

function ArticleManagement() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      setError('Не удалось загрузить статьи');
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

  const handleDeleteArticle = async (articleId, articleTitle) => {
    if (!window.confirm(`Вы уверены, что хотите удалить статью "${articleTitle}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/articles/${articleId}`);
      setSuccess(`Статья "${articleTitle}" успешно удалена!`);
      fetchArticles();
    } catch (error) {
      console.error('Ошибка удаления статьи:', error);
      setError(error.response?.data?.error || 'Не удалось удалить статью');
    }
  };

  // Безопасное получение файлов и изображений
  const getFiles = (article) => {
    try {
      if (!article.files) return [];
      return typeof article.files === 'string'
        ? JSON.parse(article.files)
        : article.files;
    } catch (error) {
      console.error('Ошибка парсинга files:', error);
      return [];
    }
  };

  const getImages = (article) => {
    try {
      if (!article.images) return [];
      return typeof article.images === 'string'
        ? JSON.parse(article.images)
        : article.images;
    } catch (error) {
      console.error('Ошибка парсинга images:', error);
      return [];
    }
  };

  const getArticleExcerpt = (content, maxLength = 100) => {
    if (!content) return '';
    const text = content.replace(/<[^>]*>/g, ''); // Удаляем HTML теги
    return text.length > maxLength
      ? text.substring(0, maxLength) + '...'
      : text;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Фильтрация статей
  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || article.category_id == selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="access-denied">
        <h2>Доступ запрещен</h2>
        <p>У вас недостаточно прав для управления статьями.</p>
        <Link to="/articles" className="btn-primary">
          Перейти к просмотру статей
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Загрузка статей...</div>;
  }


  return (
    <div className="article-management">
      <div className="page-header">
        <div className="header-content">
          <h1>Управление статьями</h1>
          <p>Создавайте, редактируйте и удаляйте статьи базы знаний</p>
        </div>
        <div className="header-actions">
          <Link to="/articles" className="btn-secondary">
            📖 Все статьи
          </Link>
          <Link to="/articles/create" className="btn-primary">
            ➕ Новая статья
          </Link>
        </div>
      </div>

      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}

      {/* Панель фильтров и поиска */}
      <div className="management-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Поиск по названию и содержанию..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-group">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            <option value="">Все категории</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="results-count">
          Найдено: {filteredArticles.length} из {articles.length} статей
        </div>
      </div>

      {/* Статистика */}
      <div className="management-stats">
        <div className="stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-info">
            <h3>Всего статей</h3>
            <p className="stat-number">{articles.length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📁</div>
          <div className="stat-info">
            <h3>Категорий</h3>
            <p className="stat-number">{categories.length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📎</div>
          <div className="stat-info">
            <h3>С файлами</h3>
            <p className="stat-number">
              {articles.filter(article => {
                const files = article.files || [];
                return files.length > 0;
              }).length}
            </p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🖼️</div>
          <div className="stat-info">
            <h3>С изображениями</h3>
            <p className="stat-number">
              {articles.filter(article => {
                const images = article.images || [];
                return images.length > 0;
              }).length}
            </p>
          </div>
        </div>
      </div>

      {/* Список статей */}
      <div className="articles-management-list">
        <div className="list-header">
          <h2>Список статей</h2>
          <span className="total-count">{filteredArticles.length} статей</span>
        </div>

        {filteredArticles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>Статьи не найдены</h3>
            <p>
              {articles.length === 0
                ? 'Создайте первую статью для базы знаний'
                : 'Попробуйте изменить параметры поиска'
              }
            </p>
            <Link to="/articles/create" className="btn-primary">
              Создать статью
            </Link>
          </div>
        ) : (
          <div className="articles-table-container">
            <table className="articles-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Категория</th>
                  <th>Содержание</th>
                  <th>Вложения</th>
                  <th>Дата создания</th>
                  <th>Автор</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredArticles.map(article => {
                  const files = getFiles(article);
                  const images = getImages(article);

                  return (
                    <tr key={article.id} className="article-row">
                      <td className="article-title-cell">
                        <strong>{article.title}</strong>
                      </td>
                      <td className="article-category-cell">
                        <span className="category-badge">{article.category_name}</span>
                      </td>
                      <td className="article-content-cell">
                        <div className="content-excerpt">
                          {getArticleExcerpt(article.content)}
                        </div>
                      </td>
                      <td className="article-attachments-cell">
                        <div className="attachments-info">
                          {files.length > 0 && (
                            <span className="file-count" title={`${files.length} файлов`}>
                              📎 {files.length}
                            </span>
                          )}
                          {images.length > 0 && (
                            <span className="image-count" title={`${images.length} изображений`}>
                              🖼️ {images.length}
                            </span>
                          )}
                          {files.length === 0 && images.length === 0 && (
                            <span className="no-attachments">—</span>
                          )}
                        </div>
                      </td>
                      <td className="article-date-cell">
                        {new Date(article.created_at).toLocaleDateString('ru-RU')}
                        {article.updated_at !== article.created_at && (
                          <div className="updated-badge" title="Обновлено">
                            ✨
                          </div>
                        )}
                      </td>
                      <td className="article-author-cell">
                        {article.author_name}
                      </td>
                      <td className="article-actions-cell">
                        <div className="action-buttons">
                          <Link
                            to={`/articles/${article.id}`}
                            className="btn-action btn-view"
                            title="Просмотреть"
                          >
                            👁️
                          </Link>
                          <Link
                            to={`/articles/edit/${article.id}`}
                            className="btn-action btn-edit"
                            title="Редактировать"
                          >
                            ✏️
                          </Link>
                          <button
                            onClick={() => handleDeleteArticle(article.id, article.title)}
                            className="btn-action btn-delete"
                            title="Удалить"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ArticleManagement;