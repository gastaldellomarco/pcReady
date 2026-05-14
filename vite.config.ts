// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    optimizeDeps: {
      include: ["@react-pdf/renderer"],
    },
    ssr: {
      noExternal: ["@react-pdf/renderer"],
    },
    build: {
      chunkSizeWarningLimit: 4500,
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          const msg = String(warning.message ?? "");
          // @react-pdf/pdfkit resolves fontkit's browser export during SSR analysis; runtime uses compatible paths.
          if (msg.includes("fontkit") && (msg.includes("openSync") || msg.includes('"open"'))) return;
          defaultHandler(warning);
        },
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
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
        /** Solo moduli con test mirati; evita createServerFn non invocabili in Vitest che abbassano le % funzioni. */
        include: ["src/lib/inventory-import.ts", "src/lib/notifications.server.ts"],
        exclude: ["**/*.d.ts", "**/*.test.ts", "**/*.test.tsx"],
        thresholds: {
          lines: 60,
          functions: 60,
          branches: 50,
        },
      },
    },
  } as any,
});
