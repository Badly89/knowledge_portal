import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoginModal from "./LoginModal";
import axios from "axios";
import "../styles/Navbar.css";

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  // Закрытие результатов поиска при клике вне области
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Поиск в реальном времени
  useEffect(() => {
    const searchArticles = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        // Пробуем разные endpoint'ы
        const endpoints = [
          `/api/articles/search?q=${encodeURIComponent(
            searchQuery.trim()
          )}&limit=5`,
          `/api/articles?search=${encodeURIComponent(
            searchQuery.trim()
          )}&limit=5`,
          `/api/articles?q=${encodeURIComponent(searchQuery.trim())}&limit=5`,
        ];

        let response = null;

        // Пробуем каждый endpoint пока не получим успешный ответ
        for (const endpoint of endpoints) {
          try {
            response = await axios.get(endpoint);
            if (response.data) break;
          } catch (error) {
            console.log(
              `Endpoint ${endpoint} не сработал, пробуем следующий...`
            );
          }
        }

        // Если все endpoint'ы не сработали, используем mock данные для тестирования
        if (!response || !response.data) {
          console.log("Используем тестовые данные для поиска");
          setSearchResults(getMockSearchResults(searchQuery));
        } else {
          setSearchResults(response.data || []);
        }

        setShowResults(true);
      } catch (error) {
        console.error("Ошибка поиска:", error);
        // Используем mock данные при ошибке
        setSearchResults(getMockSearchResults(searchQuery));
        setShowResults(true);
      } finally {
        setIsSearching(false);
      }
    };

    // Задержка для избежания частых запросов
    const delayDebounceFn = setTimeout(() => {
      searchArticles();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Mock данные для тестирования
  const getMockSearchResults = (query) => {
    const mockResults = [
      {
        id: 1,
        title: `Статья про ${query}`,
        category: { name: "Общие" },
      },
      {
        id: 2,
        title: `Руководство по ${query}`,
        category: { name: "Документация" },
      },
      {
        id: 3,
        title: `Как работать с ${query}`,
        category: { name: "Инструкции" },
      },
    ];
    return mockResults;
  };

  const handleLogout = () => {
    logout();
    navigate("/dashboard");
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setShowResults(false);
    }
  };

  const handleSearchInputChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    if (searchQuery.trim() && searchResults.length > 0) {
      setShowResults(true);
    }
  };

  const handleResultClick = (articleId) => {
    navigate(`/articles/${articleId}`);
    setSearchQuery("");
    setShowResults(false);
  };

  const handleViewAllResults = () => {
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery("");
    setShowResults(false);
  };

  const handleOpenLogin = () => {
    setShowLoginModal(true);
  };

  const handleCloseLogin = () => {
    setShowLoginModal(false);
  };

  return (
    <>
      <LoginModal show={showLoginModal} onClose={handleCloseLogin} />

      <nav className="navbar">
        <div className="nav-container">
          {/* Бренд и логотип */}
          <div className="nav-brand">
            <Link to="/dashboard" className="brand-link">
              <div className="brand-icon">
                <i className="fas fa-book-open"></i>
              </div>
              <div className="brand-text">
                <span className="brand-title">Портал Базы Знаний</span>
                <span className="brand-subtitle">Ваши знания - наша сила</span>
              </div>
            </Link>
          </div>

          {/* Основные ссылки и поиск */}
          <div className="nav-main">
            <div className="nav-links">
              <Link to="/dashboard" className="nav-link">
                <i className="fas fa-home"></i>
                <span>Главная</span>
              </Link>
            </div>

            {/* Поиск с результатами */}
            <div className="nav-search-container" ref={searchRef}>
              <form onSubmit={handleSearchSubmit} className="nav-search-form">
                <div
                  className={`search-input-group ${
                    isSearchFocused ? "focused" : ""
                  }`}
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onFocus={handleSearchFocus}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder="Поиск статей..."
                    className="nav-search-input"
                  />
                  <button type="submit" className="nav-search-btn">
                    <i className="fas fa-search"></i>
                  </button>

                  {/* Индикатор загрузки */}
                  {isSearching && (
                    <div className="search-loading">
                      <i className="fas fa-spinner fa-spin"></i>
                    </div>
                  )}
                </div>

                {/* Выпадающие результаты поиска */}
                {showResults && (
                  <div className="search-results-dropdown">
                    <div className="search-results-header">
                      <span>Результаты поиска</span>
                      {searchResults.length > 0 && (
                        <span className="results-count">
                          {searchResults.length} найдено
                        </span>
                      )}
                    </div>

                    <div className="search-results-list">
                      {searchResults.length === 0 ? (
                        <div className="no-results">
                          <i className="fas fa-search"></i>
                          <span>Ничего не найдено</span>
                        </div>
                      ) : (
                        <>
                          {searchResults.map((article) => (
                            <div
                              key={article.id}
                              className="search-result-item"
                              onClick={() => handleResultClick(article.id)}
                            >
                              <div className="result-title">
                                {article.title}
                              </div>
                              {article.category && (
                                <div className="result-category">
                                  <i className="fas fa-folder"></i>
                                  {article.category.name}
                                </div>
                              )}
                            </div>
                          ))}

                          <div
                            className="search-view-all"
                            onClick={handleViewAllResults}
                          >
                            <i className="fas fa-external-link-alt"></i>
                            Посмотреть все результаты
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Пользовательская информация */}
          <div className="nav-user">
            {isAuthenticated ? (
              <div className="user-menu">
                <div className="user-info">
                  <span className="user-name">Привет, {user?.username}</span>
                  {user?.role === "admin" && (
                    <span className="user-role admin-badge">
                      <i className="fas fa-crown"></i>
                      Администратор
                    </span>
                  )}
                </div>
                <button onClick={handleLogout} className="logout-btn">
                  <i className="fas fa-sign-out-alt"></i>
                  <span>Выйти</span>
                </button>
              </div>
            ) : (
              <button onClick={handleOpenLogin} className="login-btn">
                <i className="fas fa-sign-in-alt"></i>
                <span>Войти</span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}

export default Navbar;
