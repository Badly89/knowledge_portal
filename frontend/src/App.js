import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Categories from './pages/Categories';
import Articles from './pages/Articles';
import ArticleDetail from './pages/ArticleDetail';
import CreateArticle from './pages/CreateArticle';
import Navbar from './components/Navbar';

function ProtectedRoute({ children, requireAuth = false, requireAdmin = false }) {
  const { user, isAuthenticated } = useAuth();

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (requireAdmin && (!isAuthenticated || user?.role !== 'admin')) {
    return <Navigate to="/dashboard" />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/dashboard"
                element={<Dashboard />}
              />
              <Route
                path="/categories"
                element={<Categories />}
              />
              <Route
                path="/articles"
                element={<Articles />}
              />
              <Route
                path="/articles/:id"
                element={<ArticleDetail />}
              />
              <Route
                path="/articles/create"
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <CreateArticle />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;