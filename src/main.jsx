import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OlympicsDashboard from "./OlympicsDashboard.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <OlympicsDashboard />
  </StrictMode>
);
