import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  base: "/yoga_location/",
  plugins: [react()],
  server: {
    host: true,
  },
})
