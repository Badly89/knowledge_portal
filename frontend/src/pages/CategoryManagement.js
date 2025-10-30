import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [categoryStats, setCategoryStats] = useState({});
  const [managementStats, setManagementStats] = useState({
    totalArticles: 0,
    activeCategories: 0,
    totalCategories: 0
  });

  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    fetchCategories();
    fetchStats();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
      setError('Не удалось загрузить категории');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Статистика по статьям в категориях
      const categoryStatsResponse = await axios.get('/api/articles/stats/categories');
      setCategoryStats(categoryStatsResponse.data);

      // Общая статистика (если endpoint доступен)
      try {
        const managementStatsResponse = await axios.get('/api/articles/management/stats');
        setManagementStats(managementStatsResponse.data);
      } catch (managementError) {
        console.warn('Endpoint management/stats недоступен, используем расчетные значения');
        // Рассчитываем статистику на основе имеющихся данных
        const totalArticles = Object.values(categoryStatsResponse.data).reduce((sum, count) => sum + count, 0);
        const activeCategories = Object.keys(categoryStatsResponse.data).length;
        setManagementStats({
          totalArticles,
          activeCategories,
          totalCategories: categories.length
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      // Устанавливаем значения по умолчанию
      setCategoryStats({});
      setManagementStats({
        totalArticles: 0,
        activeCategories: 0,
        totalCategories: categories.length
      });
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await axios.post('/api/categories', categoryForm);
      setCategoryForm({ name: '', description: '' });
      setShowCreateForm(false);
      setSuccess('Категория успешно создана!');
      await fetchCategories();
      await fetchStats();
    } catch (error) {
      console.error('Ошибка создания категории:', error);
      setError(error.response?.data?.error || 'Не удалось создать категорию');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCategory = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await axios.put(`/api/categories/${editingCategory.id}`, categoryForm);
      setCategoryForm({ name: '', description: '' });
      setEditingCategory(null);
      setSuccess('Категория успешно обновлена!');
      await fetchCategories();
    } catch (error) {
      console.error('Ошибка обновления категории:', error);
      setError(error.response?.data?.error || 'Не удалось обновить категорию');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId, categoryName) => {
    if (!window.confirm(`Вы уверены, что хотите удалить категорию "${categoryName}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/categories/${categoryId}`);
      setSuccess(`Категория "${categoryName}" успешно удалена!`);
      await fetchCategories();
      await fetchStats();
    } catch (error) {
      console.error('Ошибка удаления категории:', error);
      const errorMsg = error.response?.data?.error || 'Не удалось удалить категорию';
      alert(errorMsg);
      setError(errorMsg);
    }
  };

  const startEdit = (category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || ''
    });
    setShowCreateForm(false);
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '' });
    setError('');
    setSuccess('');
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setCategoryForm({ name: '', description: '' });
    setError('');
    setSuccess('');
  };

  const getArticleCount = (categoryId) => {
    return categoryStats[categoryId] || 0;
  };

  const getTotalArticles = () => {
    return Object.values(categoryStats).reduce((sum, count) => sum + count, 0);
  };

  const getActiveCategoriesCount = () => {
    return Object.keys(categoryStats).length;
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="access-denied">
        <h2>Доступ запрещен</h2>
        <p>У вас недостаточно прав для управления категориями.</p>
        <Link to="/categories" className="btn-primary">
          Перейти к просмотру категорий
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Загрузка категорий...</div>;
  }

  return (
    <div className="category-management">
      <div className="page-header">
        <div className="header-content">
          <h1>
            <i className="fas fa-cog me-2"></i>
            Управление категориями
          </h1>
          <p>Создавайте, редактируйте и удаляйте категории статей</p>
        </div>
        <div className="header-actions">
          <Link to="/categories" className="btn-secondary">
            <i className="fas fa-folder me-1"></i>
            Все категории
          </Link>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingCategory(null);
              setCategoryForm({ name: '', description: '' });
              setError('');
              setSuccess('');
            }}
            className="btn-primary"
          >
            <i className="fas fa-plus me-1"></i>
            Новая категория
          </button>
        </div>
      </div>

      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}

      {/* Форма создания/редактирования */}
      {(showCreateForm || editingCategory) && (
        <div className="category-form-panel">
          <div className="form-header">
            <h3>{editingCategory ? 'Редактирование категории' : 'Создание новой категории'}</h3>
          </div>

          <form onSubmit={editingCategory ? handleEditCategory : handleCreateCategory}>
            <div className="form-group">
              <label>Название категории *</label>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                required
                placeholder="Введите название категории"
                maxLength="100"
              />
              <div className="char-count">{categoryForm.name.length}/100</div>
            </div>

            <div className="form-group">
              <label>Описание</label>
              <textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                rows="4"
                placeholder="Введите описание категории (необязательно)"
                maxLength="500"
              />
              <div className="char-count">{categoryForm.description.length}/500</div>
            </div>

            <div className="form-actions">
              <button type="submit" disabled={submitting} className="btn-save">
                {submitting ? (
                  <span className="loading-spinner-small"></span>
                ) : (
                  editingCategory ? '💾 Сохранить изменения' : '✅ Создать категорию'
                )}
              </button>
              <button
                type="button"
                onClick={editingCategory ? cancelEdit : cancelCreate}
                className="btn-cancel"
                disabled={submitting}
              >
                ❌ Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Статистика */}
      <div className="management-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-folder"></i>
          </div>
          <div className="stat-info">
            <h3>Всего категорий</h3>
            <p className="stat-number">{categories.length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-book"></i>
          </div>
          <div className="stat-info">
            <h3>Всего статей</h3>
            <p className="stat-number">{getTotalArticles()}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-chart-bar"></i>
          </div>
          <div className="stat-info">
            <h3>Активных категорий</h3>
            <p className="stat-number">{getActiveCategoriesCount()}</p>
            <small>Категории со статьями</small>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="stat-info">
            <h3>Заполненность</h3>
            <p className="stat-number">
              {categories.length > 0
                ? `${Math.round((getActiveCategoriesCount() / categories.length) * 100)}%`
                : '0%'
              }
            </p>
            <small>Категорий с контентом</small>
          </div>
        </div>
      </div>

      {/* Список категорий */}
      <div className="categories-management-list">
        <div className="list-header">
          <h2>
            <i className="fas fa-list me-2"></i>
            Список категорий
          </h2>
          <div className="header-stats">
            <span className="total-count">
              <i className="fas fa-folder me-1"></i>
              {categories.length} категорий
            </span>
            <span className="active-count">
              <i className="fas fa-check-circle me-1"></i>
              {getActiveCategoriesCount()} с статьями
            </span>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <i className="fas fa-folder-open fa-3x"></i>
            </div>
            <h3>Категории отсутствуют</h3>
            <p>Создайте первую категорию для организации статей</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary"
            >
              <i className="fas fa-plus me-1"></i>
              Создать категорию
            </button>
          </div>
        ) : (
          <div className="categories-table-container">
            <table className="categories-table">
              <thead>
                <tr>
                  <th><i className="fas fa-heading me-1"></i>Название</th>
                  <th><i className="fas fa-align-left me-1"></i>Описание</th>
                  <th><i className="fas fa-file me-1"></i>Статей</th>
                  <th><i className="fas fa-info-circle me-1"></i>Статус</th>
                  <th><i className="fas fa-calendar me-1"></i>Создана</th>
                  <th><i className="fas fa-user me-1"></i>Автор</th>
                  <th><i className="fas fa-cog me-1"></i>Действия</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(category => {
                  const articleCount = getArticleCount(category.id);
                  const hasArticles = articleCount > 0;

                  return (
                    <tr key={category.id} className="category-row">
                      <td className="category-name-cell">
                        <strong>
                          <i className="fas fa-folder me-1 text-warning"></i>
                          {category.name}
                        </strong>
                      </td>
                      <td className="category-description-cell">
                        {category.description || (
                          <span className="no-description">
                            <i className="fas fa-minus me-1"></i>
                            Нет описания
                          </span>
                        )}
                      </td>
                      <td className="article-count-cell">
                        <span className={`count-badge ${hasArticles ? 'has-articles' : 'empty'}`}>
                          <i className="fas fa-file me-1"></i>
                          {articleCount}
                        </span>
                      </td>
                      <td className="status-cell">
                        <span className={`status-badge ${hasArticles ? 'active' : 'inactive'}`}>
                          {hasArticles ? (
                            <>
                              <i className="fas fa-check-circle me-1"></i>
                              Активна
                            </>
                          ) : (
                            <>
                              <i className="fas fa-pause-circle me-1"></i>
                              Нет статей
                            </>
                          )}
                        </span>
                      </td>
                      <td className="date-cell">
                        <i className="fas fa-calendar me-1"></i>
                        {new Date(category.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="author-cell">
                        <i className="fas fa-user me-1"></i>
                        {category.created_by_name}
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button
                            onClick={() => startEdit(category)}
                            className="btn-action btn-edit"
                            title="Редактировать"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.id, category.name)}
                            className="btn-action btn-delete"
                            title="Удалить"
                            disabled={hasArticles}
                          >
                            {hasArticles ? (
                              <i className="fas fa-lock"></i>
                            ) : (
                              <i className="fas fa-trash"></i>
                            )}
                          </button>
                          <Link
                            to={`/articles?category=${category.id}`}
                            className="btn-action btn-view"
                            title="Просмотреть статьи"
                          >
                            <i className="fas fa-eye"></i>
                          </Link>
                        </div>
                        {hasArticles && (
                          <div className="delete-warning">
                            <i className="fas fa-exclamation-triangle me-1"></i>
                            Нельзя удалить - {articleCount} {articleCount === 1 ? 'статья' :
                              articleCount >= 2 && articleCount <= 4 ? 'статьи' : 'статей'}
                          </div>
                        )}
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

export default CategoryManagement;