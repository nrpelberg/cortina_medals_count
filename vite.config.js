import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Must match your GitHub repo name so asset paths resolve correctly on GitHub Pages
  base: "/cortina_medals_count/",
});
