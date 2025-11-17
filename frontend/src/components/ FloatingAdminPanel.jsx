// src/components/FloatingAdminPanel.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function FloatingAdminPanel() {
  const { user, isAuthenticated } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  // Показываем панель только авторизованным администраторам
  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return (
    <div
      className={`floating-admin-panel ${
        isExpanded ? "expanded" : "collapsed"
      }`}
    >
      {/* Кнопка открытия/закрытия */}
      <button
        className="admin-panel-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? "Свернуть панель" : "Развернуть панель"}
      >
        <i className={`fas ${isExpanded ? "fa-times" : "fa-crown"}`}></i>
      </button>

      {/* Содержимое панели */}
      {isExpanded && (
        <div className="admin-panel-content">
          <div className="admin-panel-header">
            <h4>
              <i className="fas fa-crown me-2"></i>
              Панель администратора
            </h4>
          </div>

          <div className="admin-panel-actions">
            <Link
              to="/articles/create"
              className="admin-panel-btn"
              onClick={() => setIsExpanded(false)}
            >
              <i className="fas fa-plus-circle me-2"></i>
              <span>Создать статью</span>
            </Link>

            <Link
              to="/articles/manage"
              className="admin-panel-btn"
              onClick={() => setIsExpanded(false)}
            >
              <i className="fas fa-edit me-2"></i>
              <span>Управление статьями</span>
            </Link>

            <Link
              to="/categories/manage"
              className="admin-panel-btn"
              onClick={() => setIsExpanded(false)}
            >
              <i className="fas fa-cog me-2"></i>
              <span>Управление категориями</span>
            </Link>

            <Link
              to="/users"
              className="admin-panel-btn"
              onClick={() => setIsExpanded(false)}
            >
              <i className="fas fa-users me-2"></i>
              <span>Управление пользователями</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default FloatingAdminPanel;
