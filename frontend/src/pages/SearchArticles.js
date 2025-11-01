import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import axios from 'axios';

function SearchArticles() {
  const location = useLocation();
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useState({
    query: '',
    category: 'all'
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalArticles: 0,
    hasNext: false,
    hasPrev: false
  });
  const [categories, setCategories] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Получаем параметры из URL при загрузке
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const query = urlParams.get('q') || '';
    const category = urlParams.get('category') || 'all';
    const page = urlParams.get('page') || 1;

    setSearchParams({
      query,
      category
    });

    if (query) {
      performSearch(query, category, page);
    }
  }, [location.search]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
    }
  };

  // Поиск с debounce для подсказок
  const fetchSuggestions = useCallback(
    async (query) => {
      if (!query || query.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await axios.get(`/api/articles/search/suggestions?q=${encodeURIComponent(query)}`);
        setSuggestions(response.data);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Ошибка загрузки подсказок:', error);
      }
    },
    []
  );

  const performSearch = async (query, category = 'all', page = 1) => {
    if (!query.trim()) {
      setError('Введите поисковый запрос');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        q: query,
        category,
        page,
        limit: 10
      });

      const response = await axios.get(`/api/articles/search?${params}`);

      setSearchResults(response.data.articles);
      setPagination(response.data.pagination);

      // Обновляем URL без перезагрузки страницы
      const newSearchParams = new URLSearchParams({
        q: query,
        category,
        page
      });
      window.history.replaceState({}, '', `${location.pathname}?${newSearchParams}`);
    } catch (error) {
      console.error('Ошибка поиска:', error);
      setError(error.response?.data?.error || 'Произошла ошибка при поиске');
      setSearchResults([]);
    } finally {
      setLoading(false);
      setShowSuggestions(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    performSearch(searchParams.query, searchParams.category, 1);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'query') {
      fetchSuggestions(value);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchParams(prev => ({
      ...prev,
      query: suggestion.title
    }));
    setShowSuggestions(false);
    performSearch(suggestion.title, searchParams.category, 1);
  };

  const handlePageChange = (newPage) => {
    performSearch(searchParams.query, searchParams.category, newPage);
  };

  const getArticleExcerpt = (content, query) => {
    if (!content) return '';

    const text = content.replace(/<[^>]*>/g, '');
    const queryLower = query.toLowerCase();
    const contentLower = text.toLowerCase();

    const index = contentLower.indexOf(queryLower);

    if (index === -1) {
      return text.length > 150 ? text.substring(0, 150) + '...' : text;
    }

    // Показываем контекст вокруг найденного слова
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + query.length + 100);
    let excerpt = text.substring(start, end);

    if (start > 0) excerpt = '...' + excerpt;
    if (end < text.length) excerpt = excerpt + '...';

    // Подсветка найденного текста
    const regex = new RegExp(`(${query})`, 'gi');
    excerpt = excerpt.replace(regex, '<mark>$1</mark>');

    return excerpt;
  };

  const highlightText = (text, query) => {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  return (
    <div className="search-articles">
      <div className="page-header">
        <h1>
          <i className="fas fa-search me-2"></i>
          Поиск по статьям
        </h1>
        <p>Найдите нужную информацию в базе знаний</p>
      </div>

      {/* Поисковая форма */}
      <div className="search-form-container">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-group">
            <div className="search-input-wrapper">
              <input
                type="text"
                name="query"
                value={searchParams.query}
                onChange={handleInputChange}
                placeholder="Введите поисковый запрос..."
                className="search-input"
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={suggestion.id}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <i className="fas fa-file-alt me-2"></i>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: highlightText(suggestion.title, searchParams.query)
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <select
              name="category"
              value={searchParams.category}
              onChange={handleInputChange}
              className="category-filter"
            >
              <option value="all">Все категории</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <button type="submit" className="search-btn" disabled={loading}>
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin me-1"></i>
                  Поиск...
                </>
              ) : (
                <>
                  <i className="fas fa-search me-1"></i>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {error}
        </div>
      )}

      {/* Результаты поиска */}
      <div className="search-results">
        {loading ? (
          <div className="loading-results">
            <i className="fas fa-spinner fa-spin fa-2x mb-3"></i>
            <p>Ищем статьи...</p>
          </div>
        ) : searchResults.length > 0 ? (
          <>
            <div className="results-header">
              <h2>
                Найдено {pagination.totalArticles} {pagination.totalArticles === 1 ? 'статья' :
                  pagination.totalArticles >= 2 && pagination.totalArticles <= 4 ? 'статьи' : 'статей'}
              </h2>
              <div className="search-info">
                По запросу: <strong>"{searchParams.query}"</strong>
                {searchParams.category !== 'all' && (
                  <> в категории: <strong>{
                    categories.find(c => c.id == searchParams.category)?.name
                  }</strong></>
                )}
              </div>
            </div>

            <div className="results-list">
              {searchResults.map(article => (
                <article key={article.id} className="search-result-item">
                  <div className="result-content">
                    <h3 className="result-title">
                      <Link to={`/articles/${article.id}`}>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: highlightText(article.title, searchParams.query)
                          }}
                        />
                      </Link>
                    </h3>

                    <div className="result-meta">
                      <span className="result-category">
                        <i className="fas fa-folder me-1"></i>
                        {article.category_name}
                      </span>
                      <span className="result-author">
                        <i className="fas fa-user me-1"></i>
                        {article.author_name}
                      </span>
                      <span className="result-date">
                        <i className="fas fa-calendar me-1"></i>
                        {new Date(article.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>

                    <div
                      className="result-excerpt"
                      dangerouslySetInnerHTML={{
                        __html: getArticleExcerpt(article.content, searchParams.query)
                      }}
                    />

                    {(article.files?.length > 0 || article.images?.length > 0) && (
                      <div className="result-attachments">
                        {article.files?.length > 0 && (
                          <span className="attachment-count">
                            <i className="fas fa-paperclip me-1"></i>
                            {article.files.length} файл(ов)
                          </span>
                        )}
                        {article.images?.length > 0 && (
                          <span className="attachment-count">
                            <i className="fas fa-image me-1"></i>
                            {article.images.length} изображений
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="result-actions">
                    <Link to={`/articles/${article.id}`} className="read-more-btn">
                      <i className="fas fa-eye me-1"></i>
                      Читать
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {/* Пагинация */}
            {pagination.totalPages > 1 && (
              <div className="search-pagination">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrev}
                  className="pagination-btn"
                >
                  <i className="fas fa-chevron-left me-1"></i>
                  Назад
                </button>

                <div className="pagination-info">
                  Страница {pagination.currentPage} из {pagination.totalPages}
                </div>

                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNext}
                  className="pagination-btn"
                >
                  Вперед
                  <i className="fas fa-chevron-right ms-1"></i>
                </button>
              </div>
            )}
          </>
        ) : searchParams.query && !loading ? (
          <div className="no-results">
            <div className="no-results-icon">
              <i className="fas fa-search fa-3x mb-3"></i>
            </div>
            <h3>Ничего не найдено</h3>
            <p>Попробуйте изменить поисковый запрос или выбрать другую категорию</p>
            <div className="no-results-suggestions">
              <p>Советы по поиску:</p>
              <ul>
                <li>Проверьте правильность написания</li>
                <li>Используйте более общие ключевые слова</li>
                <li>Попробуйте другой способ формулировки запроса</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="search-placeholder">
            <div className="placeholder-icon">
              <i className="fas fa-search fa-3x mb-3"></i>
            </div>
            <h3>Начните поиск</h3>
            <p>Введите запрос в поле выше чтобы найти статьи в базе знаний</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchArticles;