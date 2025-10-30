import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

function ArticleDetail() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchArticle();
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

  // Закрытие модального окна по клавише Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeImageModal();
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Блокируем скролл страницы
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset'; // Восстанавливаем скролл
    };
  }, [showModal]);

  if (loading) {
    return <div className="loading">Загрузка статьи...</div>;
  }

  if (error) {
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

  return (
    <div className="article-detail">
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
        <Link to="/articles" className="back-link">
          <i className="fas fa-arrow-left me-1"></i>
          Назад к статьям
        </Link>
      </div>

      <article className="article-content">
        <header className="article-header">
          <h1>{article.title}</h1>
          <div className="article-meta">
            <span className="category">
              <i className="fas fa-folder me-1"></i>
              Категория: {article.category_name}
            </span>
            <span className="author">
              <i className="fas fa-user me-1"></i>
              Автор: {article.author_name}
            </span>
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
          </div>
        </header>

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

        <div className="article-body">
          <div
            className="content"
            dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, '<br>') }}
          />
        </div>

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
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
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
    </div>
  );
}

export default ArticleDetail;