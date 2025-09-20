// src/main.jsx
import { AuthProvider } from './context/AuthProvider.jsx';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const app = (
  <AuthProvider>
    <App />
  </AuthProvider>
);

const element = import.meta.env.PROD
  ? <React.StrictMode>{app}</React.StrictMode>
  : app;

ReactDOM.createRoot(document.getElementById("root")).render(element);
