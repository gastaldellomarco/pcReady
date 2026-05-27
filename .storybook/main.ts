import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
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
