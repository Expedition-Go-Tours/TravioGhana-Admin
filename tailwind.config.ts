import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
        display: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        xs: ["13px", { lineHeight: "18px" }],
        sm: ["14px", { lineHeight: "20px" }],
        md: ["15px", { lineHeight: "22px" }],
        lg: ["17px", { lineHeight: "24px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["28px", { lineHeight: "36px" }],
        "4xl": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em" }],
        "5xl": ["40px", { lineHeight: "48px", letterSpacing: "-0.025em" }],
      },
      screens: {
        xs: "480px",
      },
      colors: {
        sidebar: {
          bg: "hsl(var(--sidebar-bg))",
          surface: "hsl(var(--sidebar-surface))",
          border: "hsl(var(--sidebar-border))",
          text: "hsl(var(--sidebar-text))",
          "text-active": "hsl(var(--sidebar-text-active))",
        },
        text: {
          primary: "hsl(var(--text-primary))",
          secondary: "hsl(var(--text-secondary))",
          tertiary: "hsl(var(--text-tertiary))",
        },
        surface: {
          base: "hsl(var(--surface-base))",
          muted: "hsl(var(--surface-muted))",
          strong: "hsl(var(--success))",
        },
        border: {
          DEFAULT: "hsl(var(--border))",
          muted: "hsl(var(--border-muted))",
        },
        status: {
          pending: "hsl(var(--status-pending))",
          approved: "hsl(var(--status-approved))",
          active: "hsl(var(--status-active))",
          rejected: "hsl(var(--status-rejected))",
          suspended: "hsl(var(--status-suspended))",
          flagged: "hsl(var(--status-flagged))",
          processing: "hsl(var(--status-processing))",
          // Label steps. The seven above are fill chroma, tuned to sit at low
          // alpha behind a badge; all seven measured 2.2-4.3:1 as text and are
          // therefore never used for the label. These are the accessible
          // equivalents (6.7-9.9:1) and are what getStatusColor puts on the text.
          "pending-text": "hsl(var(--status-pending-text))",
          "approved-text": "hsl(var(--status-approved-text))",
          "active-text": "hsl(var(--status-active-text))",
          "rejected-text": "hsl(var(--status-rejected-text))",
          "suspended-text": "hsl(var(--status-suspended-text))",
          "flagged-text": "hsl(var(--status-flagged-text))",
          "processing-text": "hsl(var(--status-processing-text))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        "brand-dark": "hsl(var(--brand-dark))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "12px",
        "3xl": "12px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,55,112,0.04)",
        DEFAULT: "0 1px 3px rgba(0,55,112,0.08)",
        md: "0 2px 6px rgba(0,55,112,0.06)",
        lg: "0 4px 12px rgba(0,55,112,0.08)",
      },
    },
  },
  plugins: [animate],
};

export default config;
