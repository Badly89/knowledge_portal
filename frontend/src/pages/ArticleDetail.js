import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import '../styles/articles.css';

function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Состояния для редактирования
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    content: '',
    category_id: ''
  });
  const [categories, setCategories] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [filesToRemove, setFilesToRemove] = useState([]);
  const [imagesToRemove, setImagesToRemove] = useState([]);
  const viewIncremented = useRef(false); // Флаг для отслеживания увеличения просмотров

  useEffect(() => {
    fetchArticle();
    fetchCategories();
  }, [id]);


  const fetchArticle = async () => {
    try {
      const response = await axios.get(`/api/articles/${id}`);
      setArticle(response.data);
    } catch (error) {
      console.error('Ошибка загрузки статьи:', error);
      setError('Статья не найдена');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const incrementViews = async () => {
      // Проверяем, что статья загружена и просмотры еще не увеличивались
      if (article && !viewIncremented.current) {
        try {
          await axios.post(`/api/articles/${id}/view`);
          viewIncremented.current = true; // Устанавливаем флаг
          // Обновляем локальное состояние
          setArticle(prev => ({
            ...prev,
            views: (prev.views || 0) + 1
          }));
        } catch (error) {
          console.error('Ошибка обновления просмотров:', error);
        }
      }
    };

    incrementViews();
  }, [article, id]); // Зависимость от article, а не от id

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
    }
  };

  // Безопасное получение файлов и изображений
  const getFiles = () => {
    if (!article || !article.files) return [];
    try {
      return typeof article.files === 'string'
        ? JSON.parse(article.files)
        : article.files;
    } catch (error) {
      console.error('Ошибка парсинга files:', error);
      return [];
    }
  };

  const getImages = () => {
    if (!article || !article.images) return [];
    try {
      return typeof article.images === 'string'
        ? JSON.parse(article.images)
        : article.images;
    } catch (error) {
      console.error('Ошибка парсинга images:', error);
      return [];
    }
  };

  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = `data:${file.type};base64,${file.data}`;
    link.download = file.name;
    link.click();
  };

  const openImageModal = (image, index) => {
    setSelectedImage({ ...image, index });
    setShowModal(true);
  };

  const closeImageModal = () => {
    setShowModal(false);
    setSelectedImage(null);
  };

  const navigateImage = (direction) => {
    const images = getImages();
    if (!selectedImage || images.length <= 1) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (selectedImage.index + 1) % images.length;
    } else {
      newIndex = (selectedImage.index - 1 + images.length) % images.length;
    }

    setSelectedImage({ ...images[newIndex], index: newIndex });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`/api/articles/${id}`);
      navigate('/articles/manage');
    } catch (error) {
      console.error('Ошибка удаления статьи:', error);
      setError('Не удалось удалить статью');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // Открытие модального окна редактирования
  const handleEdit = async () => {
    try {
      setEditLoading(true);
      const response = await axios.get(`/api/articles/${id}/edit`);
      const articleData = response.data;

      setEditFormData({
        title: articleData.title,
        content: articleData.content,
        category_id: articleData.category_id
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

  // Закрытие модального окна редактирования
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditFormData({
      title: '',
      content: '',
      category_id: ''
    });
    setNewFiles([]);
    setNewImages([]);
    setFilesToRemove([]);
    setImagesToRemove([]);
  };

  // Обработка изменений формы
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
    const files = getFiles();
    setFilesToRemove(files.map(file => file.id));
  };

  // Удаление всех изображений
  const removeAllImages = () => {
    const images = getImages();
    setImagesToRemove(images.map(image => image.id));
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
      await axios.put(`/api/articles/${id}`, {
        ...editFormData,
        files: newFiles,
        images: newImages,
        filesToRemove,
        imagesToRemove
      });

      setError('');
      closeEditModal();
      fetchArticle(); // Обновляем данные статьи
    } catch (error) {
      console.error('Ошибка обновления статьи:', error);
      setError(error.response?.data?.error || 'Не удалось обновить статью');
    } finally {
      setEditLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Получение существующих файлов и изображений для отображения в модальном окне
  const existingFiles = article ? getFiles() : [];
  const existingImages = article ? getImages() : [];
  const displayFiles = existingFiles.filter(file => !filesToRemove.includes(file.id));
  const displayImages = existingImages.filter(image => !imagesToRemove.includes(image.id));

  // Закрытие модальных окон по клавише Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeImageModal();
        if (showDeleteConfirm) cancelDelete();
        if (showEditModal) closeEditModal();
      }
    };

    if (showModal || showDeleteConfirm || showEditModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showModal, showDeleteConfirm, showEditModal]);

  if (loading) {
    return <div className="loading">Загрузка статьи...</div>;
  }

  if (error && !article) {
    return (
      <div className="error-page">
        <h2>Статья не найдена</h2>
        <p>{error}</p>
        <Link to="/articles" className="btn-primary">
          Назад к статьям
        </Link>
      </div>
    );
  }

  const files = getFiles();
  const images = getImages();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  return (
    <div className="article-detail">
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

              <div className="form-group">
                <label>Содержание *</label>
                <textarea
                  name="content"
                  value={editFormData.content}
                  onChange={handleEditFormChange}
                  rows="10"
                  required
                  placeholder="Введите содержание статьи"
                />
              </div>

              {/* Существующие файлы */}
              <div className="form-group">
                <div className="section-header">
                  <label>Существующие файлы</label>
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
                                <button
                                  type="button"
                                  onClick={() => removeExistingFile(file.id)}
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

                      {/* Удаленные файлы */}
                      {filesToRemove.length > 0 && (
                        <div className="removed-files">
                          <div className="removed-header">
                            <h4>Файлы для удаления ({filesToRemove.length}):</h4>
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
                    <button
                      type="button"
                      onClick={removeAllImages}
                      className="btn-remove-all"
                      title="Удалить все изображения"
                    >
                      <i className="fas fa-trash"></i>
                      Удалить все изображения
                    </button>
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

      {/* Модальное окно подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Подтверждение удаления</h3>
              <button
                className="modal-close"
                onClick={cancelDelete}
                aria-label="Закрыть"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>Вы уверены, что хотите удалить статью <strong>"{article?.title}"</strong>?</p>
              <p className="text-warning">Это действие нельзя отменить.</p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={cancelDelete}
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                className="btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <i className="fas fa-spinner fa-spin me-1"></i>
                    Удаление...
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash me-1"></i>
                    Удалить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для увеличенного изображения */}
      {showModal && selectedImage && (
        <div className="image-modal-overlay" onClick={closeImageModal}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="image-modal-header">
              <h3>{selectedImage.name}</h3>
              <button
                className="image-modal-close"
                onClick={closeImageModal}
                aria-label="Закрыть"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="image-modal-body">
              <img
                src={`data:${selectedImage.type};base64,${selectedImage.data}`}
                alt={selectedImage.name}
                className="image-modal-img"
              />
            </div>

            <div className="image-modal-footer">
              <div className="image-navigation">
                {images.length > 1 && (
                  <>
                    <button
                      className="nav-btn prev-btn"
                      onClick={() => navigateImage('prev')}
                      aria-label="Предыдущее изображение"
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <span className="image-counter">
                      {selectedImage.index + 1} / {images.length}
                    </span>
                    <button
                      className="nav-btn next-btn"
                      onClick={() => navigateImage('next')}
                      aria-label="Следующее изображение"
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </>
                )}
              </div>

              <div className="image-actions">
                <button
                  className="download-image-btn"
                  onClick={() => downloadFile(selectedImage)}
                >
                  <i className="fas fa-download me-1"></i>
                  Скачать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="article-nav">
        <div className="nav-left">
          <Link to="/articles" className="back-link">
            <i className="fas fa-arrow-left me-1"></i>
            Назад к статьям
          </Link>
        </div>


      </div>

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {error}
        </div>
      )}

      <article className="article-content">
        <header className="article-header">
          <div className="article-title-section">
            <h1>{article.title}</h1>
            {isAdmin && (
              <div className="article-admin-badge">
                <i className="fas fa-crown me-1"></i>
                Режим администратора
              </div>
            )}
          </div>

          <div className="article-meta">
            <div className='meta-left'>
              <span className="category">
                <i className="fas fa-folder me-1"></i>
                Категория: {article.category_name}
              </span>
              <span className="author">
                <i className="fas fa-user me-1"></i>
                Автор: {article.author_name}
              </span>

            </div>
            <div className='meta-right'>
              <span className="date">
                <i className="fas fa-calendar me-1"></i>
                Опубликовано: {new Date(article.created_at).toLocaleDateString('ru-RU')}
              </span>
              {article.updated_at !== article.created_at && (
                <span className="updated">
                  <i className="fas fa-sync me-1"></i>
                  Обновлено: {new Date(article.updated_at).toLocaleDateString('ru-RU')}
                </span>
              )}
              <span>Просмотров: {article.viewcount || 0}</span>
            </div>
          </div>
        </header>

        <div className="article-body">
          <div
            className="content"
            dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, '<br>') }}
          />
        </div>

        {images.length > 0 && (
          <div className="article-images">
            <h3>
              <i className="fas fa-images me-2"></i>
              Изображения ({images.length})
            </h3>
            <div className="images-grid">
              {images.map((image, index) => (
                <div key={index} className="image-item">
                  <div
                    className="image-thumbnail-container"
                    onClick={() => openImageModal(image, index)}
                  >
                    <img
                      src={`data:${image.type};base64,${image.data}`}
                      alt={image.name}
                      className="article-image-thumbnail"
                    />
                    <div className="image-overlay">
                      <i className="fas fa-search-plus"></i>
                    </div>
                  </div>
                  <p className="image-caption">{image.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}



        {files.length > 0 && (
          <div className="article-attachments">
            <h3>
              <i className="fas fa-paperclip me-2"></i>
              Прикрепленные файлы ({files.length})
            </h3>
            <div className="files-list">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-icon">
                    <i className="fas fa-file"></i>
                  </span>
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    onClick={() => downloadFile(file)}
                    className="download-btn"
                  >
                    <i className="fas fa-download me-1"></i>
                    Скачать
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Панель быстрых действий для администратора */}
      {isAdmin && (
        <div className="admin-quick-actions">
          <div className="quick-actions-content">
            <h5>Быстрые действия:</h5>
            <div className="action-buttons">
              <button onClick={handleEdit} className="btn-action btn-edit">
                <i className="fas fa-edit"></i>
                Редактировать
              </button>
              <button onClick={confirmDelete} className="btn-action btn-delete">
                <i className="fas fa-trash"></i>
                Удалить
              </button>
              <Link to="/articles/manage" className="btn-action btn-manage">
                <i className="fas fa-cog"></i>
                Управление
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArticleDetail;