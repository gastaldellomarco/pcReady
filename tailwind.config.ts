import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config = {
  theme: {
    extend: {
      screens: {
        xs: "320px",
        sm: "375px",
        s390: "390px",
        md: "768px",
        lg: "1024px",
      },
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          light: "var(--primary-light)",
          foreground: "var(--primary-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          hover: "var(--success-hover)",
          light: "var(--success-light)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          light: "var(--warning-light)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          light: "var(--danger-light)",
        },
        info: {
          DEFAULT: "var(--info)",
          light: "var(--info-light)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        surface: "var(--page-surface)",
        card: "var(--card)",
        border: "var(--border)",
        overlay: "var(--overlay)",
      },
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: ["11px", { lineHeight: "1.35" }],
        sm: ["13px", { lineHeight: "1.45" }],
        base: ["15px", { lineHeight: "1.55" }],
        md: ["17px", { lineHeight: "1.4" }],
        lg: ["20px", { lineHeight: "1.35" }],
        xl: ["24px", { lineHeight: "1.25" }],
        "2xl": ["30px", { lineHeight: "1.15" }],
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities(
        {
          ".touch-target": {
            minWidth: "44px",
            minHeight: "44px",
            padding: "8px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          },
          ".safe-area-inset": {
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingTop: "env(safe-area-inset-top)",
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
          },
          ".overflow-x-auto-table": {
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          },
        },
        { variants: ["responsive"] },
      );
    }),
  ],
} satisfies Config;

export default config;
