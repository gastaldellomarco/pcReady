import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (base) =>
    mergeConfig(base, {
      plugins: [tailwindcss(), tsconfigPaths({ projects: ["./tsconfig.json"] })],
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "..", "src"),
          "@root": path.resolve(__dirname, ".."),
        },
      },
    }),
};

export default config;
