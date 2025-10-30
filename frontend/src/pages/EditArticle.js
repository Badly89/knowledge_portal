import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

function EditArticle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/articles');
      return;
    }

    fetchArticle();
    fetchCategories();
  }, [id, isAuthenticated, user, navigate]);


  // Безопасное получение данных
  const safeParseJSON = (data) => {
    if (!data) return [];
    try {
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
      console.error('Ошибка парсинга JSON:', error);
      return [];
    }
  };

  const fetchArticle = async () => {
    try {
      const response = await axios.get(`/api/articles/${id}/edit`);
      const article = response.data;

      setTitle(article.title);
      setContent(article.content);
      setCategoryId(article.category_id);

      // Обрабатываем существующие файлы и изображения
      const parsedFiles = safeParseJSON(article.files);
      const parsedImages = safeParseJSON(article.images);

      setExistingFiles(parsedFiles);
      setFiles(parsedFiles);
      setExistingImages(parsedImages);
      setImages(parsedImages);
    } catch (error) {
      console.error('Ошибка загрузки статьи:', error);
      setError('Не удалось загрузить статью для редактирования');
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

  const handleFileUpload = (e, type) => {
    const selectedFiles = Array.from(e.target.files);

    selectedFiles.forEach(file => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target.result.split(',')[1]
        };

        if (type === 'file') {
          setFiles(prev => [...prev, fileData]);
        } else {
          setImages(prev => [...prev, fileData]);
        }
      };

      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index, type) => {
    if (type === 'file') {
      setFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await axios.put(`/api/articles/${id}`, {
        title,
        content,
        category_id: categoryId,
        files,
        images
      });

      navigate('/articles/manage');
    } catch (error) {
      console.error('Ошибка обновления статьи:', error);
      setError(error.response?.data?.error || 'Не удалось обновить статью');
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  if (loading) {
    return <div className="loading">Загрузка статьи...</div>;
  }

  return (
    <div className="edit-article">
      <div className="page-header">
        <div className="header-content">
          <h1>Редактирование статьи</h1>
          <p>Внесите изменения в статью базы знаний</p>
        </div>
        <Link to="/articles/manage" className="btn-secondary">
          ↩️ Назад к управлению
        </Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="article-form">
        <div className="form-group">
          <label>Название статьи *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Введите название статьи"
          />
        </div>

        <div className="form-group">
          <label>Категория *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Выберите категорию</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Содержание *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows="15"
            required
            placeholder="Введите содержание статьи"
          />
        </div>

        <div className="form-group">
          <label>Файлы</label>
          <div className="file-upload-section">
            <input
              type="file"
              multiple
              onChange={(e) => handleFileUpload(e, 'file')}
              className="file-input"
            />
            <div className="file-list">
              <h4>Прикрепленные файлы:</h4>
              {files.length === 0 ? (
                <p className="no-files">Файлы не прикреплены</p>
              ) : (
                <ul className="files-list">
                  {files.map((file, index) => (
                    <li key={index} className="file-item">
                      <span className="file-name">📎 {file.name}</span>
                      <span className="file-size">({formatFileSize(file.size)})</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index, 'file')}
                        className="remove-file-btn"
                        title="Удалить файл"
                      >
                        ❌
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Изображения</label>
          <div className="image-upload-section">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileUpload(e, 'image')}
              className="file-input"
            />
            <div className="image-list">
              <h4>Прикрепленные изображения:</h4>
              {images.length === 0 ? (
                <p className="no-images">Изображения не прикреплены</p>
              ) : (
                <div className="images-grid">
                  {images.map((image, index) => (
                    <div key={index} className="image-item">
                      <img
                        src={`data:${image.type};base64,${image.data}`}
                        alt={image.name}
                        className="preview-image"
                      />
                      <div className="image-info">
                        <span className="image-name">{image.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index, 'image')}
                          className="remove-image-btn"
                          title="Удалить изображение"
                        >
                          ❌
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={submitting} className="btn-save">
            {submitting ? '💾 Сохранение...' : '💾 Сохранить изменения'}
          </button>
          <Link to="/articles/manage" className="btn-cancel">
            ❌ Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}

export default EditArticle;