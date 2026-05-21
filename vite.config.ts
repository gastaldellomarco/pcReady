import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  const plugins = [
    tanstackStart({
      router: {
        autoCodeSplitting: true,
      },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
  ];

  if (command === "build") {
    plugins.push(
      ViteImageOptimizer({
        png: { quality: 80 },
        jpeg: { quality: 80 },
        jpg: { quality: 80 },
        webp: { quality: 80 },
        avif: { quality: 70 },
        svg: {
          multipass: true,
          plugins: [{ name: "preset-default", params: { overrides: { removeViewBox: false } } }],
        },
      }),
      cloudflare({
        viteEnvironment: { name: "ssr" },
      }),
    );
  }

  return {
    define: envDefine,
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins,
    optimizeDeps: {
      include: ["@react-pdf/renderer"],
    },
    ssr: {
      noExternal: ["@react-pdf/renderer"],
    },
    build: {
      target: "esnext",
      minify: "esbuild",
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          const msg = String(warning.message ?? "");
          if (msg.includes("fontkit") && (msg.includes("openSync") || msg.includes('"open"')))
            return;
          defaultHandler(warning);
        },
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (
              id.includes("/react-dom/") ||
              id.includes("/react/") ||
              id.includes("@tanstack/react-router") ||
              id.includes("@tanstack/react-query") ||
              id.includes("@tanstack/query-core")
            ) {
              return "vendor";
            }
            if (id.includes("@supabase/supabase-js")) return "vendor-supabase";
            if (id.includes("@react-pdf")) return "vendor-pdf";
            if (id.includes("recharts")) return "vendor-charts";
            if (id.includes("@dnd-kit")) return "vendor-dnd";
            if (id.includes("reactflow") || id.includes("@xyflow")) return "vendor-flow";
            if (id.includes("swagger-ui")) return "vendor-swagger";
            if (id.includes("@radix-ui")) return "vendor-radix";
          },
        },
      },
    },
    test: {
      environment: "node",
      globals: true,
      include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
        include: ["src/lib/inventory-import.ts", "src/lib/notifications.server.ts"],
        exclude: ["**/*.d.ts", "**/*.test.ts", "**/*.test.tsx"],
        thresholds: {
          lines: 60,
          functions: 60,
          branches: 50,
        },
      },
    },
  };
});
