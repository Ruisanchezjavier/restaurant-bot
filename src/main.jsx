import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RestaurantChatbot from "./RestaurantChatbot.jsx";
import AdminPanel from "./AdminPanel.jsx";

const isAdmin = window.location.pathname === "/admin";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isAdmin ? <AdminPanel /> : <RestaurantChatbot />}
  </StrictMode>
);
