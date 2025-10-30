import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

function ArticleDetail() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    article.files || [];
  };

  const getImages = () => {
    article.images || [];
  };

  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = `data:${file.type};base64,${file.data}`;
    link.download = file.name;
    link.click();
  };

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
      <div className="article-nav">
        <Link to="/articles" className="back-link">← Назад к статьям</Link>
      </div>

      <article className="article-content">
        <header className="article-header">
          <h1>{article.title}</h1>
          <div className="article-meta">
            <span className="category">Категория: {article.category_name}</span>
            <span className="author">Автор: {article.author_name}</span>
            <span className="date">
              Опубликовано: {new Date(article.created_at).toLocaleDateString('ru-RU')}
            </span>
            {article.updated_at !== article.created_at && (
              <span className="updated">
                Обновлено: {new Date(article.updated_at).toLocaleDateString('ru-RU')}
              </span>
            )}
          </div>
        </header>

        {images.length > 0 && (
          <div className="article-images">
            <h3>Изображения</h3>
            <div className="images-grid">
              {images.map((image, index) => (
                <div key={index} className="image-item">
                  <img
                    src={`data:${image.type};base64,${image.data}`}
                    alt={image.name}
                    className="article-image"
                  />
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
            <h3>Прикрепленные файлы</h3>
            <div className="files-list">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-icon">📎</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                  <button
                    onClick={() => downloadFile(file)}
                    className="download-btn"
                  >
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