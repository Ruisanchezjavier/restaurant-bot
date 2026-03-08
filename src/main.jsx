import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RestaurantChatbot from "./RestaurantChatbot.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RestaurantChatbot />
  </StrictMode>
);
