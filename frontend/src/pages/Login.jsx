import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { login, loading, error, clearError } = useAuth();
  const navigate = useNavigate();

  // Очищаем ошибки при изменении полей ввода или размонтировании компонента
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // Очищаем ошибку при изменении полей ввода
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [username, password, error, clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Предотвращаем множественные отправки
    if (loading) return;

    const result = await login(username, password);

    if (result.success) {
      navigate("/dashboard");
    }
    // Ошибка уже установлена в AuthContext, поэтому не нужно устанавливать здесь
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Портал Базы Знаний - Вход</h2>

        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label htmlFor="username">Имя пользователя:</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            required
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Пароль:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={loading ? "button-loading" : "btn-login"}
        >
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}

export default Login;
