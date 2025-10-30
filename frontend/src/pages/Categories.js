import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
      setError('Не удалось загрузить категории');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await axios.post('/api/categories', categoryForm);
      setCategoryForm({ name: '', description: '' });
      setShowCreateForm(false);
      fetchCategories(); // Обновляем список
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

    try {
      await axios.put(`/api/categories/${editingCategory.id}`, categoryForm);
      setCategoryForm({ name: '', description: '' });
      setEditingCategory(null);
      fetchCategories(); // Обновляем список
    } catch (error) {
      console.error('Ошибка обновления категории:', error);
      setError(error.response?.data?.error || 'Не удалось обновить категорию');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту категорию?')) {
      return;
    }

    try {
      await axios.delete(`/api/categories/${categoryId}`);
      fetchCategories(); // Обновляем список
    } catch (error) {
      console.error('Ошибка удаления категории:', error);
      alert(error.response?.data?.error || 'Не удалось удалить категорию');
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
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '' });
    setError('');
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setCategoryForm({ name: '', description: '' });
    setError('');
  };

  if (loading) {
    return <div className="loading">Загрузка категорий...</div>;
  }

  return (
    <div className="categories-page">
      <div className="page-header">
        <h1>Категории</h1>
        {isAuthenticated && user?.role === 'admin' && !editingCategory && (
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingCategory(null);
              setCategoryForm({ name: '', description: '' });
              setError('');
            }}
            className="btn-primary"
          >
            Добавить категорию
          </button>
        )}
      </div>

      {(showCreateForm || editingCategory) && (
        <div className="category-form">
          <h3>{editingCategory ? 'Редактировать категорию' : 'Создать новую категорию'}</h3>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={editingCategory ? handleEditCategory : handleCreateCategory}>
            <div className="form-group">
              <label>Название категории:</label>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                required
                placeholder="Введите название категории"
              />
            </div>
            <div className="form-group">
              <label>Описание (необязательно):</label>
              <textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                rows="3"
                placeholder="Введите описание категории"
              />
            </div>
            <div className="form-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? 'Сохранение...' : (editingCategory ? 'Обновить' : 'Создать')}
              </button>
              <button
                type="button"
                onClick={editingCategory ? cancelEdit : cancelCreate}
                className="btn-secondary"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="categories-grid">
        {categories.length === 0 ? (
          <div className="no-categories">
            <p>Категории отсутствуют.</p>
            {isAuthenticated && user?.role === 'admin' && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary"
              >
                Создать первую категорию
              </button>
            )}
          </div>
        ) : (
          categories.map(category => (
            <div key={category.id} className="category-card">
              <div className="category-header">
                <h3 className="category-name">{category.name}</h3>
                {isAuthenticated && user?.role === 'admin' && (
                  <div className="category-actions">
                    <button
                      onClick={() => startEdit(category)}
                      className="btn-edit"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="btn-delete"
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              {category.description && (
                <p className="category-description">{category.description}</p>
              )}

              <div className="category-meta">
                <span>Создано: {category.created_by_name}</span>
                <span>{new Date(category.created_at).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Categories;