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
  const [newFiles, setNewFiles] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [filesToRemove, setFilesToRemove] = useState([]);
  const [imagesToRemove, setImagesToRemove] = useState([]);
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
      setExistingImages(parsedImages);
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

  const handleNewFileUpload = (e, type) => {
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
          setNewFiles(prev => [...prev, fileData]);
        } else {
          setNewImages(prev => [...prev, fileData]);
        }
      };

      reader.readAsDataURL(file);
    });

    // Сбрасываем значение input для возможности повторной загрузки тех же файлов
    e.target.value = '';
  };

  const removeExistingFile = (fileId) => {
    setFilesToRemove(prev => [...prev, fileId]);
  };

  const removeExistingImage = (imageId) => {
    setImagesToRemove(prev => [...prev, imageId]);
  };

  const removeNewFile = (index, type) => {
    if (type === 'file') {
      setNewFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setNewImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const restoreExistingFile = (fileId) => {
    setFilesToRemove(prev => prev.filter(id => id !== fileId));
  };

  const restoreExistingImage = (imageId) => {
    setImagesToRemove(prev => prev.filter(id => id !== imageId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await axios.put(`/api/articles/${id}`, {
        title,
        content,
        category_id: categoryId,
        files: newFiles,
        images: newImages,
        filesToRemove,
        imagesToRemove
      });

      console.log('Статья обновлена:', response.data);
      navigate('/articles/manage');
    } catch (error) {
      console.error('Ошибка обновления статьи:', error);
      setError(error.response?.data?.error || 'Не удалось обновить статью');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadFile = async (fileId, fileName) => {
    try {
      const response = await axios.get(`/api/articles/${id}/files/${fileId}/download`);
      const fileData = response.data;

      // Создаем временную ссылку для скачивания
      const link = document.createElement('a');
      link.href = `data:${fileData.type};base64,${fileData.data}`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      setError('Не удалось скачать файл');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Фильтруем существующие файлы и изображения для отображения
  const displayFiles = existingFiles.filter(file => !filesToRemove.includes(file.id));
  const displayImages = existingImages.filter(image => !imagesToRemove.includes(image.id));

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

        {/* Существующие файлы */}
        <div className="form-group">
          <label>Существующие файлы</label>
          <div className="existing-files-section">
            {displayFiles.length === 0 ? (
              <p className="no-files">Нет прикрепленных файлов</p>
            ) : (
              <div className="files-list">
                <h4>Текущие файлы:</h4>
                <ul className="files-list">
                  {displayFiles.map((file) => (
                    <li key={file.id} className="file-item existing">
                      <div className="file-info">
                        <span className="file-name">📎 {file.name}</span>
                        <span className="file-size">({formatFileSize(file.size)})</span>
                      </div>
                      <div className="file-actions">
                        <button
                          type="button"
                          onClick={() => downloadFile(file.id, file.name)}
                          className="download-file-btn"
                          title="Скачать файл"
                        >
                          ⬇️
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExistingFile(file.id)}
                          className="remove-file-btn"
                          title="Удалить файл"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Удаленные файлы (можно восстановить) */}
            {filesToRemove.length > 0 && (
              <div className="removed-files">
                <h4>Файлы, отмеченные для удаления:</h4>
                <ul className="files-list">
                  {existingFiles
                    .filter(file => filesToRemove.includes(file.id))
                    .map((file) => (
                      <li key={file.id} className="file-item removed">
                        <span className="file-name">🗑️ {file.name}</span>
                        <button
                          type="button"
                          onClick={() => restoreExistingFile(file.id)}
                          className="restore-file-btn"
                          title="Восстановить файл"
                        >
                          ↩️
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Новые файлы */}
        <div className="form-group">
          <label>Добавить новые файлы</label>
          <div className="new-files-section">
            <input
              type="file"
              multiple
              onChange={(e) => handleNewFileUpload(e, 'file')}
              className="file-input"
            />
            {newFiles.length > 0 && (
              <div className="new-files-list">
                <h4>Новые файлы для загрузки:</h4>
                <ul className="files-list">
                  {newFiles.map((file, index) => (
                    <li key={index} className="file-item new">
                      <span className="file-name">🆕 {file.name}</span>
                      <span className="file-size">({formatFileSize(file.size)})</span>
                      <button
                        type="button"
                        onClick={() => removeNewFile(index, 'file')}
                        className="remove-file-btn"
                        title="Удалить файл"
                      >
                        ❌
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Существующие изображения */}
        <div className="form-group">
          <label>Существующие изображения</label>
          <div className="existing-images-section">
            {displayImages.length === 0 ? (
              <p className="no-images">Нет прикрепленных изображений</p>
            ) : (
              <div className="images-grid">
                <h4>Текущие изображения:</h4>
                <div className="images-grid">
                  {displayImages.map((image) => (
                    <div key={image.id} className="image-item existing">
                      <img
                        src={`data:${image.type};base64,${image.data}`}
                        alt={image.name}
                        className="preview-image"
                      />
                      <div className="image-info">
                        <span className="image-name">{image.name}</span>
                        <div className="image-actions">
                          <button
                            type="button"
                            onClick={() => downloadFile(image.id, image.name)}
                            className="download-image-btn"
                            title="Скачать изображение"
                          >
                            ⬇️
                          </button>
                          <button
                            type="button"
                            onClick={() => removeExistingImage(image.id)}
                            className="remove-image-btn"
                            title="Удалить изображение"
                          >
                            ❌
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Удаленные изображения (можно восстановить) */}
            {imagesToRemove.length > 0 && (
              <div className="removed-images">
                <h4>Изображения, отмеченные для удаления:</h4>
                <div className="images-grid">
                  {existingImages
                    .filter(image => imagesToRemove.includes(image.id))
                    .map((image) => (
                      <div key={image.id} className="image-item removed">
                        <img
                          src={`data:${image.type};base64,${image.data}`}
                          alt={image.name}
                          className="preview-image removed"
                        />
                        <div className="image-info">
                          <span className="image-name">🗑️ {image.name}</span>
                          <button
                            type="button"
                            onClick={() => restoreExistingImage(image.id)}
                            className="restore-image-btn"
                            title="Восстановить изображение"
                          >
                            ↩️
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Новые изображения */}
        <div className="form-group">
          <label>Добавить новые изображения</label>
          <div className="new-images-section">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleNewFileUpload(e, 'image')}
              className="file-input"
            />
            {newImages.length > 0 && (
              <div className="new-images-list">
                <h4>Новые изображения для загрузки:</h4>
                <div className="images-grid">
                  {newImages.map((image, index) => (
                    <div key={index} className="image-item new">
                      <img
                        src={`data:${image.type};base64,${image.data}`}
                        alt={image.name}
                        className="preview-image"
                      />
                      <div className="image-info">
                        <span className="image-name">🆕 {image.name}</span>
                        <button
                          type="button"
                          onClick={() => removeNewFile(index, 'image')}
                          className="remove-image-btn"
                          title="Удалить изображение"
                        >
                          ❌
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

      {/* Статистика изменений */}
      {(newFiles.length > 0 || newImages.length > 0 || filesToRemove.length > 0 || imagesToRemove.length > 0) && (
        <div className="changes-summary">
          <h3>Сводка изменений:</h3>
          <ul>
            {newFiles.length > 0 && <li>📎 Добавлено файлов: {newFiles.length}</li>}
            {filesToRemove.length > 0 && <li>🗑️ Удалено файлов: {filesToRemove.length}</li>}
            {newImages.length > 0 && <li>🖼️ Добавлено изображений: {newImages.length}</li>}
            {imagesToRemove.length > 0 && <li>🗑️ Удалено изображений: {imagesToRemove.length}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default EditArticle;