import React from "react";
import ReactDOM from "react-dom/client";

// Tailwind 入口 + 设计系统 CSS 变量
import "./styles/globals.css";

import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
