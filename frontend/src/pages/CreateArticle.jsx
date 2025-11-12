import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import RichTextEditor from "../components/RichTextEditor";

function CreateArticle() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [enableSlideshow, setEnableSlideshow] = useState(false);
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get("/api/categories");
      setCategories(response.data);
    } catch (error) {
      console.error("Ошибка загрузки категорий:", error);
    }
  };

  // Функция для извлечения изображений из контента
  const extractImagesFromContent = (content) => {
    if (!content) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    const images = Array.from(doc.querySelectorAll("img"));

    return images.map((img) => ({
      src: img.src,
      alt: img.alt || "Изображение из статьи",
      title: img.title || img.alt || "Изображение из статьи",
    }));
  };

  // Проверка, есть ли изображения в контенте
  const hasImagesInContent = (content) => {
    return extractImagesFromContent(content).length > 0;
  };

  const handleFileUpload = (e, type) => {
    const selectedFiles = Array.from(e.target.files);

    selectedFiles.forEach((file) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target.result.split(",")[1],
        };

        if (type === "file") {
          setFiles((prev) => [...prev, fileData]);
        } else {
          setImages((prev) => [...prev, fileData]);
        }
      };

      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index, type) => {
    if (type === "file") {
      setFiles((prev) => prev.filter((_, i) => i !== index));
    } else {
      setImages((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Автоматически включаем слайд-шоу если есть изображения в контенте
    const finalEnableSlideshow = enableSlideshow || hasImagesInContent(content);

    try {
      await axios.post("/api/articles", {
        title,
        content,
        category_id: categoryId,
        enable_slideshow: finalEnableSlideshow,
        files,
        images,
      });

      navigate("/articles");
    } catch (error) {
      setError(error.response?.data?.error || "Не удалось создать статью");
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="create-article">
      <h2>Создать новую статью</h2>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
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
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Переключатель слайд-шоу */}
        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enableSlideshow}
              onChange={(e) => setEnableSlideshow(e.target.checked)}
            />
            <span className="checkmark"></span>
            Включить слайд-шоу для изображений из содержания
          </label>
          <small className="form-help">
            {hasImagesInContent(content)
              ? "В содержании обнаружены изображения. Они будут отображаться в слайд-шоу и не будут показаны в тексте статьи."
              : "При включении этой опции изображения из редактора будут отображаться только в слайд-шоу и не будут показываться в основном тексте статьи."}
          </small>
        </div>

        <div className="form-group">
          <label>Содержание *</label>
          <RichTextEditor value={content} onChange={setContent} height={400} />
          {(enableSlideshow || hasImagesInContent(content)) && (
            <div className="slideshow-preview-info">
              <i className="fas fa-info-circle"></i>
              {hasImagesInContent(content)
                ? `Обнаружено ${
                    extractImagesFromContent(content).length
                  } изображений в содержании. Они будут отображаться в слайд-шоу.`
                : "Изображения, добавленные в редактор, будут отображаться только в слайд-шоу."}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Прикрепить файлы</label>
          <input
            type="file"
            multiple
            onChange={(e) => handleFileUpload(e, "file")}
            className="file-input"
          />
          {files.length > 0 && (
            <div className="files-list-container">
              <h4>Выбранные файлы ({files.length}):</h4>
              <ul className="files-list">
                {files.map((file, index) => (
                  <li key={index} className="file-item">
                    <div className="file-info">
                      <span className="file-icon">📎</span>
                      <div className="file-details">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index, "file")}
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

        <div className="form-group">
          <label>Загрузить дополнительные изображения</label>
          <small className="form-help">
            Эти изображения будут отображаться отдельно от слайд-шоу, в разделе
            дополнительных изображений
          </small>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleFileUpload(e, "image")}
            className="file-input"
          />
          {images.length > 0 && (
            <div className="images-container">
              <h4>Выбранные изображения ({images.length}):</h4>
              <div className="images-grid">
                {images.map((image, index) => (
                  <div key={index} className="image-item">
                    <div className="image-preview">
                      <img
                        src={`data:${image.type};base64,${image.data}`}
                        alt={image.name}
                        className="preview-image"
                      />
                      <div className="image-overlay">
                        <button
                          type="button"
                          onClick={() => removeFile(index, "image")}
                          className="btn-remove-image"
                          title="Удалить изображение"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    </div>
                    <div className="image-info">
                      <span className="image-name">{image.name}</span>
                      <span className="image-size">
                        {formatFileSize(image.size)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Сводка */}
        {(files.length > 0 ||
          images.length > 0 ||
          hasImagesInContent(content)) && (
          <div className="creation-summary">
            <h4>Сводка создаваемой статьи:</h4>
            <div className="summary-list">
              {hasImagesInContent(content) && (
                <div className="summary-item">
                  <i className="fas fa-images"></i>
                  Изображений в содержании:{" "}
                  <strong>{extractImagesFromContent(content).length}</strong>
                  {enableSlideshow && (
                    <span className="summary-badge">(в слайд-шоу)</span>
                  )}
                </div>
              )}
              {files.length > 0 && (
                <div className="summary-item">
                  <i className="fas fa-file"></i>
                  Прикрепленных файлов: <strong>{files.length}</strong>
                </div>
              )}
              {images.length > 0 && (
                <div className="summary-item">
                  <i className="fas fa-image"></i>
                  Дополнительных изображений: <strong>{images.length}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate("/articles")}
            className="btn-secondary"
            disabled={loading}
          >
            Отмена
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin me-1"></i>
                Создание...
              </>
            ) : (
              <>
                <i className="fas fa-plus me-1"></i>
                Создать статью
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateArticle;
