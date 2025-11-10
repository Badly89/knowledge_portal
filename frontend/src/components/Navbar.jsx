import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Navbar.css'; // Создадим этот файл для стилей

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/dashboard');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <>
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
              {<Link to="/dashboard" className="nav-link">
                <i className="fas fa-home"></i>
                <span>Главная</span>
              </Link>

            /*  <Link to="/articles" className="nav-link">
                <i className="fas fa-file-alt"></i>
                <span>Статьи</span>
              </Link> */}
            </div>

            {/* Поиск */}
            <div className="nav-search-container">
              <form onSubmit={handleSearch} className="nav-search-form">
                <div className={`search-input-group ${isSearchFocused ? 'focused' : ''}`}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder="Поиск статей..."
                    className="nav-search-input"
                  />
                  <button type="submit" className="nav-search-btn">
                    <i className="fas fa-search"></i>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Пользовательская информация */}
          <div className="nav-user">
            {isAuthenticated ? (
              <button onClick={handleLogout} className="logout-btn">
                <i className="fas fa-sign-out-alt"></i>
                <span>Выйти</span>
              </button>

            ) : (
              <Link to="/login" className="login-btn">
                <i className="fas fa-sign-in-alt"></i>
                <span>Войти</span>
              </Link>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}

export default Navbar;