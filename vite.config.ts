import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.TAURI_ENV_PLATFORM === undefined ? "/via-custom-ui-for-vial/" : "./",
  resolve: {
    alias: {
      webRawHID:
        process.env.TAURI_ENV_PLATFORM === undefined
          ? path.resolve(__dirname, "src/services/platform/web/webRawHID.ts")
          : path.resolve(__dirname, "src/services/platform/tauri/rawHID.ts"),
    },
  },
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    strictPort: true,
  },
  // to access the Tauri environment variables set by the CLI with information about the current target
  envPrefix: [
    "VITE_",
    "TAURI_ENV_PLATFORM",
    "TAURI_ENV_ARCH",
    "TAURI_ENV_FAMILY",
    "TAURI_ENV_PLATFORM_VERSION",
    "TAURI_ENV_PLATFORM_TYPE",
    "TAURI_ENV_DEBUG",
  ],
  build:
    process.env.TAURI_PLATFORM === undefined
      ? undefined
      : {
          // Tauri uses Chromium on Windows and WebKit on macOS and Linux
          target: process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
          // don't minify for debug builds
          minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
          // produce sourcemaps for debug builds
          sourcemap: !!process.env.TAURI_ENV_DEBUG,
        },
});
