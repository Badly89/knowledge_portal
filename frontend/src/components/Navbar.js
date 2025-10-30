import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

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
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/dashboard">
          <i className="fas fa-book-open me-2"></i>
          Портал Базы Знаний
        </Link>
      </div>

      <div className="nav-search">
        <form onSubmit={handleSearch} className="nav-search-form">
          <div className="search-input-group">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск статей..."
              className="nav-search-input"
            />
            <button type="submit" className="nav-search-btn">
              <i className="fas fa-search"></i>
            </button>
          </div>
        </form>
      </div>

      <div className="nav-links">
        <Link to="/dashboard">
          <i className="fas fa-home me-1"></i>
          Главная
        </Link>
        <Link to="/categories">
          <i className="fas fa-folder me-1"></i>
          Категории
        </Link>
        <Link to="/articles">
          <i className="fas fa-file-alt me-1"></i>
          Статьи
        </Link>

        {isAuthenticated ? (
          <>

            <span className="user-info">
              <i className="fas fa-user me-1"></i>
              {user?.username} ({user?.role === 'admin' ? 'администратор' : 'пользователь'})
            </span>
            <button onClick={handleLogout} className="logout-btn">
              <i className="fas fa-sign-out-alt me-1"></i>
              Выйти
            </button>
          </>
        ) : (
          <Link to="/login" className="login-btn">
            <i className="fas fa-sign-in-alt me-1"></i>
            Войти
          </Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;