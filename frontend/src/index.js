import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// Hide loading screen when app is ready
function hideLoadingScreen() {
  if (window.hideLoadingScreen) {
    window.hideLoadingScreen();
  }
}

// Show error fallback
function showErrorFallback(error) {
  console.error('Error rendering app:', error);
  if (window.showErrorFallback) {
    window.showErrorFallback();
  }
}

// Render the app
try {
  const root = ReactDOM.createRoot(document.getElementById('root'));

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Hide loading screen after render
  setTimeout(hideLoadingScreen, 100);

} catch (error) {
  showErrorFallback(error);
}

// Handle runtime errors
window.addEventListener('error', (event) => {
  console.error('Runtime error:', event.error);
});

// Handle uncaught promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});