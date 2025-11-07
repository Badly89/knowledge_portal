import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import RichTextEditor from '../components/RichTextEditor';
import ArticleSlideshow from '../components/ArticleSlideshow';

function ArticleManagement() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingArticle, setEditingArticle] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSlideshow, setShowSlideshow] = useState(true);

  const [editFormData, setEditFormData] = useState({
    title: '',
    content: '',
    category_id: '',
    enable_slideshow: true // Новое поле для слайд-шоу

  });
  const [editLoading, setEditLoading] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [filesToRemove, setFilesToRemove] = useState([]);
  const [imagesToRemove, setImagesToRemove] = useState([]);

  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await axios.get('/api/articles');
      setArticles(response.data);
      // Устанавливаем состояние слайд-шоу из данных статьи
      setShowSlideshow(response.data.enable_slideshow !== false);
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

  // Открытие модального окна редактирования
  const handleEditArticle = async (articleId) => {
    try {
      setEditLoading(true);
      const response = await axios.get(`/api/articles/${articleId}/edit`);
      const article = response.data;

      setEditingArticle(article);
      setEditFormData({
        title: article.title,
        content: article.content,
        category_id: article.category_id,
        enable_slideshow: article.enable_slideshow !== false // По умолчанию true
      });

      // Сбрасываем состояния файлов
      setNewFiles([]);
      setNewImages([]);
      setFilesToRemove([]);
      setImagesToRemove([]);

      setShowEditModal(true);
    } catch (error) {
      console.error('Ошибка загрузки статьи для редактирования:', error);
      setError('Не удалось загрузить статью для редактирования');
    } finally {
      setEditLoading(false);
    }
  };

  // Закрытие модального окна
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingArticle(null);
    setEditFormData({
      title: '',
      content: '',
      category_id: '',
      enable_slideshow: true
    });
    setNewFiles([]);
    setNewImages([]);
    setFilesToRemove([]);
    setImagesToRemove([]);
  };

  // Обработчик изменения обычных полей формы
  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;

    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Обработчик изменения контента редактора
  const handleContentChange = (newContent) => {
    setEditFormData(prev => ({
      ...prev,
      content: newContent
    }));
  };
  // Обработчик изменения чекбокса слайд-шоу
  const handleSlideshowToggle = (e) => {
    const { checked } = e.target;

    setEditFormData(prev => {
      let newContent = prev.content;

      // Если включаем слайд-шоу, удаляем весь текст, оставляя только изображения
      if (checked) {
        newContent = removeTextKeepImages(prev.content);
      }

      return {
        ...prev,
        enable_slideshow: checked,
        content: newContent
      };
    });
  };

  // Функция для удаления текста, оставляя только изображения
  const removeTextKeepImages = (htmlContent) => {
    if (!htmlContent) return '';

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const images = doc.querySelectorAll('img');

      // Создаем новый документ только с изображениями
      const newDoc = document.implementation.createHTMLDocument();
      const body = newDoc.body;

      images.forEach(img => {
        const newImg = newDoc.createElement('img');
        newImg.src = img.src;
        newImg.alt = img.alt;
        newImg.className = img.className;
        newImg.style.cssText = img.style.cssText;
        body.appendChild(newImg);
      });

      return body.innerHTML;
    } catch (error) {
      console.error('Error removing text from content:', error);
      return htmlContent;
    }
  };

  // Функция для подсчета изображений в контенте
  const countImagesInContent = (htmlContent) => {
    if (!htmlContent) return 0;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const imgElements = doc.querySelectorAll('img');
      return imgElements.length;
    } catch (error) {
      console.error('Error counting images in content:', error);
      return 0;
    }
  };

  // Загрузка новых файлов
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

    e.target.value = '';
  };

  // Управление существующими файлами
  const removeExistingFile = (fileId) => {
    setFilesToRemove(prev => [...prev, fileId]);
  };

  const removeExistingImage = (imageId) => {
    setImagesToRemove(prev => [...prev, imageId]);
  };

  const restoreExistingFile = (fileId) => {
    setFilesToRemove(prev => prev.filter(id => id !== fileId));
  };

  const restoreExistingImage = (imageId) => {
    setImagesToRemove(prev => prev.filter(id => id !== imageId));
  };

  // Удаление всех файлов
  const removeAllFiles = () => {
    if (editingArticle) {
      const files = getFiles(editingArticle);
      setFilesToRemove(files.map(file => file.id));
    }
  };

  // Удаление всех изображений
  const removeAllImages = () => {
    if (editingArticle) {
      const images = getImages(editingArticle);
      setImagesToRemove(images.map(image => image.id));
    }
  };

  // Восстановление всех файлов
  const restoreAllFiles = () => {
    setFilesToRemove([]);
  };

  // Восстановление всех изображений
  const restoreAllImages = () => {
    setImagesToRemove([]);
  };

  // Удаление новых файлов
  const removeNewFile = (index, type) => {
    if (type === 'file') {
      setNewFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setNewImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Сохранение изменений
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);

    try {
      await axios.put(`/api/articles/${editingArticle.id}`, {
        ...editFormData,
        files: newFiles,
        images: newImages,
        filesToRemove,
        imagesToRemove
      });

      setSuccess(`Статья "${editFormData.title}" успешно обновлена!`);
      closeEditModal();
      fetchArticles();
    } catch (error) {
      console.error('Ошибка обновления статьи:', error);
      setError(error.response?.data?.error || 'Не удалось обновить статью');
    } finally {
      setEditLoading(false);
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

  // Получение существующих файлов и изображений для отображения
  const existingFiles = editingArticle ? getFiles(editingArticle) : [];
  const existingImages = editingArticle ? getImages(editingArticle) : [];
  const displayFiles = existingFiles.filter(file => !filesToRemove.includes(file.id));
  const displayImages = existingImages.filter(image => !imagesToRemove.includes(image.id));

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
      {/* Модальное окно редактирования */}
      {showEditModal && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Редактирование статьи</h2>
              <button
                className="modal-close"
                onClick={closeEditModal}
                aria-label="Закрыть"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-body">
              {editLoading && (
                <div className="loading-overlay">
                  <div className="loading-spinner"></div>
                </div>
              )}

              <div className="form-group">
                <label>Название статьи *</label>
                <input
                  type="text"
                  name="title"
                  value={editFormData.title}
                  onChange={handleEditFormChange}
                  required
                  placeholder="Введите название статьи"
                />
              </div>

              <div className="form-group">
                <label>Категория *</label>
                <select
                  name="category_id"
                  value={editFormData.category_id}
                  onChange={handleEditFormChange}
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
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="enable_slideshow"
                    checked={editFormData.enable_slideshow}
                    onChange={handleSlideshowToggle}
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom"></span>
                  <span className="checkbox-text">
                    Включить слайд-шоу изображений
                  </span>
                </label>
                <div className="checkbox-description">
                  {editFormData.enable_slideshow
                    ? 'Режим слайд-шоу: из контента будут удалены все текстовые элементы, останутся только изображения'
                    : 'Обычный режим: отображается весь контент (текст и изображения)'
                  }
                </div>
              </div>
              <div className="form-group">
                <label>Содержание *</label>
                {editFormData.enable_slideshow && (
                  <div className="slideshow-warning">
                    <i className="fas fa-exclamation-triangle"></i>
                    <div>
                      <strong>Режим слайд-шоу активен</strong>
                      <p>В этом режиме будут отображаться только изображения. Весь текст автоматически удаляется.</p>
                    </div>
                  </div>
                )}
                <RichTextEditor
                  value={editFormData.content}
                  onChange={handleContentChange}
                  height={300}
                />
                {editFormData.enable_slideshow && (
                  <div className="content-stats">
                    <i className="fas fa-info-circle"></i>
                    <span>
                      В контенте найдено {countImagesInContent(editFormData.content)} изображений для слайд-шоу
                    </span>
                  </div>
                )}
              </div>

              {/* Существующие файлы */}
              <div className="form-group">
                <div className="section-header">
                  <label>Существующие файлы</label>
                  <div>
                    {displayFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={removeAllFiles}
                        className="btn-remove-all"
                        title="Удалить все файлы"
                      >
                        <i className="fas fa-trash"></i>
                        Удалить все файлы
                      </button>
                    )}
                  </div>
                </div>
                <div className="existing-files-section">
                  {displayFiles.length === 0 && filesToRemove.length === 0 ? (
                    <p className="no-files">Нет прикрепленных файлов</p>
                  ) : (
                    <>
                      {/* Текущие файлы */}
                      {displayFiles.length > 0 && (
                        <div className="files-list-container">
                          <h4>Текущие файлы ({displayFiles.length}):</h4>
                          <ul className="files-list">
                            {displayFiles.map((file) => (
                              <li key={file.id} className="file-item existing">
                                <div className="file-info">
                                  <span className="file-icon">📎</span>
                                  <div className="file-details">
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-size">{formatFileSize(file.size)}</span>
                                  </div>
                                </div>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => removeExistingFile(file.id)}
                                    className="btn-remove"
                                    title="Удалить файл"
                                  >
                                    <i className="fas fa-times"></i>
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Удаленные файлы */}
                      {filesToRemove.length > 0 && (
                        <div className="removed-files">
                          <div className="removed-header">
                            <h4>Файлы для удаления ({filesToRemove.length}):</h4>
                            <div>
                              <button
                                type="button"
                                onClick={restoreAllFiles}
                                className="btn-restore-all"
                                title="Восстановить все файлы"
                              >
                                <i className="fas fa-undo"></i>
                                Восстановить все
                              </button>
                            </div>
                          </div>
                          <ul className="files-list">
                            {existingFiles
                              .filter(file => filesToRemove.includes(file.id))
                              .map((file) => (
                                <li key={file.id} className="file-item removed">
                                  <div className="file-info">
                                    <span className="file-icon">🗑️</span>
                                    <div className="file-details">
                                      <span className="file-name">{file.name}</span>
                                      <span className="file-size">{formatFileSize(file.size)}</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => restoreExistingFile(file.id)}
                                    className="btn-restore"
                                    title="Восстановить файл"
                                  >
                                    <i className="fas fa-undo"></i>
                                  </button>
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </>
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
                      <h4>Новые файлы ({newFiles.length}):</h4>
                      <ul className="files-list">
                        {newFiles.map((file, index) => (
                          <li key={index} className="file-item new">
                            <div className="file-info">
                              <span className="file-icon">🆕</span>
                              <div className="file-details">
                                <span className="file-name">{file.name}</span>
                                <span className="file-size">{formatFileSize(file.size)}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeNewFile(index, 'file')}
                              className="btn-remove"
                              title="Удалить файл"
                            >
                              <i className="fas fa-times"></i>
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
                <div className="section-header">
                  <label>Существующие изображения</label>
                  {displayImages.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={removeAllImages}
                        className="btn-remove-all"
                        title="Удалить все изображения"
                      >
                        <i className="fas fa-trash"></i>
                        Удалить все изображения
                      </button>
                    </div>
                  )}
                </div>
                <div className="existing-images-section">
                  {displayImages.length === 0 && imagesToRemove.length === 0 ? (
                    <p className="no-images">Нет прикрепленных изображений</p>
                  ) : (
                    <>
                      {/* Текущие изображения */}
                      {displayImages.length > 0 && (
                        <div className="images-container">
                          <h4>Текущие изображения ({displayImages.length}):</h4>
                          <div className="images-grid">
                            {displayImages.map((image) => (
                              <div key={image.id} className="image-item existing">
                                <div className="image-preview">
                                  <img
                                    src={`data:${image.type};base64,${image.data}`}
                                    alt={image.name}
                                    className="preview-image"
                                  />
                                  <div className="image-overlay">
                                    <button
                                      type="button"
                                      onClick={() => removeExistingImage(image.id)}
                                      className="btn-remove-image"
                                      title="Удалить изображение"
                                    >
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  </div>
                                </div>
                                <div className="image-info">
                                  <span className="image-name">{image.name}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Удаленные изображения */}
                      {imagesToRemove.length > 0 && (
                        <div className="removed-images">
                          <div className="removed-header">
                            <h4>Изображения для удаления ({imagesToRemove.length}):</h4>
                            <div>
                              <button
                                type="button"
                                onClick={restoreAllImages}
                                className="btn-restore-all"
                                title="Восстановить все изображения"
                              >
                                <i className="fas fa-undo"></i>
                                Восстановить все
                              </button>
                            </div>
                          </div>
                          <div className="images-grid">
                            {existingImages
                              .filter(image => imagesToRemove.includes(image.id))
                              .map((image) => (
                                <div key={image.id} className="image-item removed">
                                  <div className="image-preview">
                                    <img
                                      src={`data:${image.type};base64,${image.data}`}
                                      alt={image.name}
                                      className="preview-image removed"
                                    />
                                    <div className="image-overlay">
                                      <button
                                        type="button"
                                        onClick={() => restoreExistingImage(image.id)}
                                        className="btn-restore-image"
                                        title="Восстановить изображение"
                                      >
                                        <i className="fas fa-undo"></i>
                                      </button>
                                    </div>
                                  </div>
                                  <div className="image-info">
                                    <span className="image-name">{image.name}</span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
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
                      <h4>Новые изображения ({newImages.length}):</h4>
                      <div className="images-grid">
                        {newImages.map((image, index) => (
                          <div key={index} className="image-item new">
                            <div className="image-preview">
                              <img
                                src={`data:${image.type};base64,${image.data}`}
                                alt={image.name}
                                className="preview-image"
                              />
                              <div className="image-overlay">
                                <button
                                  type="button"
                                  onClick={() => removeNewFile(index, 'image')}
                                  className="btn-remove-image"
                                  title="Удалить изображение"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                            </div>
                            <div className="image-info">
                              <span className="image-name">{image.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Сводка изменений */}
              {(newFiles.length > 0 || newImages.length > 0 || filesToRemove.length > 0 || imagesToRemove.length > 0) && (
                <div className="changes-summary">
                  <h4>Сводка изменений вложения:</h4>
                  <div className="changes-list">
                    {newFiles.length > 0 && (
                      <div className="change-item positive">
                        <i className="fas fa-plus"></i>
                        Добавлено файлов: <strong>{newFiles.length}</strong>
                      </div>
                    )}
                    {filesToRemove.length > 0 && (
                      <div className="change-item negative">
                        <i className="fas fa-minus"></i>
                        Удалено файлов: <strong>{filesToRemove.length}</strong>
                      </div>
                    )}
                    {newImages.length > 0 && (
                      <div className="change-item positive">
                        <i className="fas fa-plus"></i>
                        Добавлено изображений: <strong>{newImages.length}</strong>
                      </div>
                    )}
                    {imagesToRemove.length > 0 && (
                      <div className="change-item negative">
                        <i className="fas fa-minus"></i>
                        Удалено изображений: <strong>{imagesToRemove.length}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </form>

            <div className="modal-footer">
              <button
                type="button"
                onClick={closeEditModal}
                className="btn-secondary"
                disabled={editLoading}
              >
                Отмена
              </button>
              <button
                type="submit"
                onClick={handleSaveEdit}
                className="btn-primary"
                disabled={editLoading}
              >
                {editLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin me-1"></i>
                    Сохранение...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save me-1"></i>
                    Сохранить изменения
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div className="header-content">
          <h1>Управление статьями</h1>
          <p>Создавайте, редактируйте и удаляйте статьи базы знаний</p>
        </div>
        <div className="header-actions">
          <Link to="/articles/create" className="btn-primary">
            <i className="fas fa-plus me-1"></i>
            Создать статью
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
                              <i className="fas fa-file"></i> {files.length}
                            </span>
                          )}
                          {images.length > 0 && (
                            <span className="image-count" title={`${images.length} изображений`}>
                              <i className="fas fa-image"></i> {images.length}
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
                            <i className="fas fa-sync-alt"></i>
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
                            <i className="fas fa-eye"></i>
                          </Link>
                          <button
                            onClick={() => handleEditArticle(article.id)}
                            className="btn-action btn-edit"
                            title="Редактировать"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteArticle(article.id, article.title)}
                            className="btn-action btn-delete"
                            title="Удалить"
                          >
                            <i className="fas fa-trash"></i>
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