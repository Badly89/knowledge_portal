import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/dashboard');
  };

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/dashboard">База Знаний</Link>
      </div>

      <div className="nav-links">
        <Link to="/dashboard">Главная</Link>
        <Link to="/categories">Категории</Link>
        <Link to="/articles">Статьи</Link>

        {isAuthenticated ? (
          <>
            {user?.role === 'admin' && (
              <Link to="/articles/create">Создать статью</Link>
            )}
            <span className="user-info">
              Добро пожаловать, {user?.username} ({user?.role === 'admin' ? 'администратор' : 'пользователь'})
            </span>
            <button onClick={handleLogout} className="logout-btn">
              Выйти
            </button>
          </>
        ) : (
          <Link to="/login" className="login-btn">
            Войти
          </Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;