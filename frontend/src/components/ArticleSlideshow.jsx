// components/ArticleSlideshow.jsx
import React, { useState, useEffect } from "react";
import "../styles/ArticleSlideshow.css";

const ArticleSlideshow = ({ content, images = [] }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideshowImages, setSlideshowImages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Извлекаем изображения из двух источников: HTML контента и пропса images
  useEffect(() => {
    setLoading(true);

    try {
      const imagesFromContent = extractImagesFromHTML(content);
      const imagesFromProps = Array.isArray(images) ? images : [];

      // Объединяем изображения из обоих источников
      const allImages = [...imagesFromProps, ...imagesFromContent];

      // Убираем дубликаты по src и фильтруем некорректные изображения
      const uniqueImages = allImages.filter(
        (image, index, self) =>
          image &&
          image.src &&
          index === self.findIndex((img) => img && img.src === image.src)
      );

      console.log("Processed slideshow images:", uniqueImages);
      setSlideshowImages(uniqueImages);
    } catch (error) {
      console.error("Error processing slideshow images:", error);
      setSlideshowImages([]);
    } finally {
      setLoading(false);
    }
  }, [content, images]);

  // Функция для извлечения изображений из HTML
  const extractImagesFromHTML = (htmlContent) => {
    if (!htmlContent || typeof htmlContent !== "string") return [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");
      const imgElements = doc.querySelectorAll("img");

      return Array.from(imgElements)
        .map((img, index) => ({
          src: img.src || "",
          alt: img.alt || `Slide ${index + 1}`,
          index: index,
        }))
        .filter((img) => img.src); // Фильтруем изображения без src
    } catch (error) {
      console.error("Error parsing HTML for images:", error);
      return [];
    }
  };

  const nextSlide = () => {
    if (slideshowImages.length <= 1) return;
    setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
  };

  const prevSlide = () => {
    if (slideshowImages.length <= 1) return;
    setCurrentSlide(
      (prev) => (prev - 1 + slideshowImages.length) % slideshowImages.length
    );
  };

  const goToSlide = (index) => {
    if (index >= 0 && index < slideshowImages.length) {
      setCurrentSlide(index);
    }
  };

  // Защита от ошибок при рендере
  const currentImage = slideshowImages[currentSlide];

  if (loading) {
    return (
      <div className="slideshow-loading">
        <div className="loading-spinner"></div>
        <p>Загрузка слайд-шоу...</p>
      </div>
    );
  }

  if (slideshowImages.length === 0) {
    return (
      <div className="no-images-notice">
        <i className="fas fa-image"></i>
        <p>Нет изображений для слайд-шоу</p>
        <small>Добавьте изображения в содержание статьи</small>
      </div>
    );
  }

  if (!currentImage) {
    return (
      <div className="slideshow-error">
        <i className="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки слайд-шоу</p>
        <button onClick={() => setCurrentSlide(0)} className="btn-retry">
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="article-slideshow">
      <div className="slideshow-container">
        {slideshowImages.length > 1 && (
          <>
            <button
              className="slideshow-btn slideshow-btn--prev"
              onClick={prevSlide}
            >
              ‹
            </button>
            <button
              className="slideshow-btn slideshow-btn--next"
              onClick={nextSlide}
            >
              ›
            </button>
          </>
        )}

        <div className="slide">
          <img
            src={currentImage.src}
            alt={currentImage.alt || "Slide image"}
            className="slide-image"
            onError={(e) => {
              console.error("Error loading image:", currentImage.src);
              e.target.style.display = "none";
              // Переходим к следующему слайду если текущий не загрузился
              if (slideshowImages.length > 1) {
                setTimeout(nextSlide, 1000);
              }
            }}
            onLoad={() =>
              console.log("Image loaded successfully:", currentImage.src)
            }
          />
          {slideshowImages.length > 1 && (
            <div className="slide-counter">
              {currentSlide + 1} / {slideshowImages.length}
            </div>
          )}
        </div>
      </div>

      {/* Индикаторы */}
      {slideshowImages.length > 1 && (
        <div className="slideshow-indicators">
          {slideshowImages.map((_, index) => (
            <button
              key={index}
              className={`indicator ${index === currentSlide ? "active" : ""}`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      )}

      {/* Информация о текущем слайде */}
      <div className="slide-info">
        <span className="slide-alt">
          {currentImage.alt || `Изображение ${currentSlide + 1}`}
        </span>
      </div>
    </div>
  );
};

export default ArticleSlideshow;
