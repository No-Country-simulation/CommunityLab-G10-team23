// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Salida en servidor: la página y el BFF (/api/*) corren en el mismo proceso Node,
// igual que con Next.js. HOST y PORT se leen en tiempo de ejecución (ver Dockerfile).
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  session: false,
  vite: {
    plugins: [tailwindcss()],
  },
});
