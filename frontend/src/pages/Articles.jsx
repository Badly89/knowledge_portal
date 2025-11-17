import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";

function Articles() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState([]);

  const { user, isAuthenticated } = useAuth();

  // Получаем категорию из URL параметров при загрузке
  useEffect(() => {
    const categoryFromUrl = searchParams.get("category");
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [searchParams]);

  // Получаем категорию из URL параметров при загрузке
  useEffect(() => {
    const categoryFromUrl = searchParams.get("category");
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    // Добавляем задержку между запросами
    const fetchData = async () => {
      try {
        await fetchArticles();
        // Ждем 500ms перед запросом категорий
        await new Promise((resolve) => setTimeout(resolve, 500));
        await fetchCategories();
      } catch (error) {
        console.error("Ошибка загрузки данных:", error);
      }
    };

    fetchData();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await axios.get("/api/articles");
      setArticles(response.data);
    } catch (error) {
      console.error("Ошибка загрузки статей:", error);
      if (error.response?.status === 429) {
        console.log("Превышен лимит запросов к API статей");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get("/api/categories");
      setCategories(response.data);
    } catch (error) {
      console.error("Ошибка загрузки категорий:", error);
      if (error.response?.status === 429) {
        console.log("Превышен лимит запросов к API категорий");
        // Пробуем снова через 2 секунды
        setTimeout(fetchCategories, 2000);
      }
    }
  };

  const filteredArticles = selectedCategory
    ? articles.filter((article) => article.category_id == selectedCategory)
    : articles;

  const getArticleExcerpt = (content) => {
    return content.length > 150 ? content.substring(0, 150) + "..." : content;
  };

  // Безопасное получение файлов и изображений
  const getFiles = (article) => {
    try {
      if (!article.files) return [];
      return typeof article.files === "string"
        ? JSON.parse(article.files)
        : article.files;
    } catch (error) {
      console.error("Ошибка парсинга files:", error);
      return [];
    }
  };

  const getImages = (article) => {
    try {
      if (!article.images) return [];
      return typeof article.images === "string"
        ? JSON.parse(article.images)
        : article.images;
    } catch (error) {
      console.error("Ошибка парсинга images:", error);
      return [];
    }
  };

  // Безопасное форматирование даты
  const formatDate = (dateString) => {
    try {
      if (!dateString) return "Дата не указана";

      const date = new Date(dateString);

      // Проверяем, что дата валидна
      if (isNaN(date.getTime())) {
        return "Неверная дата";
      }

      return date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      console.error("Ошибка форматирования даты:", error);
      return "Ошибка даты";
    }
  };

  const handleCategoryChange = (e) => {
    const categoryId = e.target.value;
    setSelectedCategory(categoryId);

    // Обновляем URL параметры
    if (categoryId) {
      setSearchParams({ category: categoryId });
    } else {
      setSearchParams({});
    }
  };

  const clearFilter = () => {
    setSelectedCategory("");
    setSearchParams({});
  };

  // Получаем название выбранной категории
  const getSelectedCategoryName = () => {
    if (!selectedCategory) return null;
    const category = categories.find((cat) => cat.id == selectedCategory);
    return category ? category.name : null;
  };

  if (loading) {
    return <div className="loading">Загрузка статей...</div>;
  }

  return (
    <div className="articles-page">
      <div className="page-header">
        <h1>
          {selectedCategory ? (
            <>
              <i className="fas fa-folder me-2"></i>
              Статьи: {getSelectedCategoryName()}
            </>
          ) : (
            <>
              <i className="fas fa-file-alt me-2"></i>
              Все статьи
            </>
          )}
        </h1>
        {isAuthenticated && user?.role === "admin" && (
          <Link to="/articles/create" className="btn-primary btn-add">
            <i className="fas fa-plus me-1"></i>
            Создать статью
          </Link>
        )}
      </div>

      <div className="articles-controls">
        <div className="filter-section">
          <label htmlFor="category-filter">
            <i className="fas fa-filter me-1"></i>
            Фильтр по категории:
          </label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={handleCategoryChange}
          >
            <option value="">Все категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          {selectedCategory && (
            <button onClick={clearFilter} className="clear-filter-btn ">
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        <div className="articles-count">
          <i className="fas fa-file me-1"></i>
          Показано {filteredArticles.length} из {articles.length} статей{" "}
          {selectedCategory && (
            <span className="category-filter-info">
              в категории "{getSelectedCategoryName()}"
            </span>
          )}
        </div>
      </div>

      <div className="articles-list">
        {filteredArticles.length === 0 ? (
          <div className="no-articles">
            <i className="fas fa-inbox fa-3x mb-3"></i>
            <h3>Статьи не найдены</h3>
            <p>
              {selectedCategory
                ? `В категории "${getSelectedCategoryName()}" пока нет статей.`
                : "В базе знаний пока нет статей."}
            </p>

            {selectedCategory && (
              <button onClick={clearFilter} className="btn-secondary">
                <i className="fas fa-eye me-1"></i>
                Показать все статьи
              </button>
            )}
          </div>
        ) : (
          filteredArticles.map((article) => {
            const files = getFiles(article);
            const images = getImages(article);

            return (
              <Link
                key={article.id}
                to={`/articles/${article.id}`}
                className="read-more-btn"
              >
                <article className="article-card">
                  <div className="article-header">
                    <div className="category-badge">
                      <i className="fas fa-folder me-1"></i>
                      {article.category_name}
                    </div>
                    <div className="meta-footer-header">
                      <h2 className="article-title">{article.title}</h2>
                    </div>
                  </div>

                  <div className="article-footer">
                    <div className="article-meta ">
                      <div className="meta-footer">
                        <div className="article-attachments">
                          {/* Добавьте блок с просмотрами */}
                          <div className="article-views article-attachments-item">
                            <i className="fas fa-eye me-1"></i>
                            {article.viewscount || 0}
                          </div>
                          {files.length > 0 && (
                            <span className="attachments-count article-attachments-item">
                              <i className="fas fa-paperclip me-1"></i>
                              {files.length}
                            </span>
                          )}
                          {images.length > 0 && (
                            <div className="images-count article-attachments-item">
                              <i className="fas fa-image me-1"></i>
                              {images.length}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

export default Articles;
