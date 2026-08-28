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
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
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
        green: {
          50: "hsl(var(--green-50))",
          100: "hsl(var(--green-100))",
          200: "hsl(var(--green-200))",
          300: "hsl(var(--green-300))",
          400: "hsl(var(--green-400))",
          500: "hsl(var(--green-500))",
          600: "hsl(var(--green-600))",
          700: "hsl(var(--green-700))",
          800: "hsl(var(--green-800))",
          900: "hsl(var(--green-900))",
          950: "hsl(var(--green-950))",
        },
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
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        "2": "0 0 2px rgba(145,158,171,0.2), 0 12px 24px -4px rgba(145,158,171,0.12)",
        "soft": "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)",
        "soft-lg": "0 4px 16px rgba(0,0,0,0.04), 0 16px 48px rgba(0,0,0,0.06)",
        "tinted": "0 2px 8px hsl(163 85% 32% / 0.1), 0 8px 24px hsl(163 85% 32% / 0.08)",
        "tinted-lg": "0 4px 16px hsl(163 85% 32% / 0.12), 0 16px 48px hsl(163 85% 32% / 0.1)",
        "inner-glow": "inset 0 1px 1px rgba(255,255,255,0.6)",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.32, 0.72, 0, 1)",
        "spring-out": "cubic-bezier(0.22, 1, 0.36, 1)",
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        "400": "400ms",
        "600": "600ms",
        "800": "800ms",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out-right": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.6s cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-in": "fade-in 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
        "scale-in": "scale-in 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-in-right": "slide-in-right 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-out-right": "slide-out-right 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [animate],
};

export default config;
