import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/global.css";

// Hide loading screen when app is ready
// Render the app
try {
  const root = ReactDOM.createRoot(document.getElementById("root"));

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  window.__APP_LOADED__ = true;

  // Hide loading screen after render
  setTimeout(hideLoadingScreen, 100);
} catch (error) {
  showErrorFallback(error);
}

// Handle runtime errors
