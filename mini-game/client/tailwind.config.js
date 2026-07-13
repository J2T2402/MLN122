/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          100: "var(--color-primary-100)",
          300: "var(--color-primary-300)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          800: "var(--color-primary-800)",
          900: "var(--color-primary-900)",
        },
        accent: {
          300: "var(--color-accent-300)",
          500: "var(--color-accent-500)",
          600: "var(--color-accent-600)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          bg: "var(--color-success-bg)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          bg: "var(--color-danger-bg)",
        },
        warning: "var(--color-warning)",
        info: "var(--color-info)",
        boss: "var(--color-boss)",
        bg: "var(--bg)",
        surface: "var(--surface)",
        text: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
        },
        team: {
          1: "var(--team-1)",
          2: "var(--team-2)",
          3: "var(--team-3)",
          4: "var(--team-4)",
          5: "var(--team-5)",
          6: "var(--team-6)",
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        xs: "var(--text-xs)",
        sm: "var(--text-sm)",
        base: "var(--text-base)",
        lg: "var(--text-lg)",
        xl: "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
        "4xl": "var(--text-4xl)",
        "5xl": "var(--text-5xl)",
        "6xl": "var(--text-6xl)",
        "7xl": "var(--text-7xl)",
        "8xl": "var(--text-8xl)",
        "9xl": "var(--text-9xl)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        10: "var(--space-10)",
        12: "var(--space-12)",
        16: "var(--space-16)",
        20: "var(--space-20)",
        24: "var(--space-24)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        glow: "var(--shadow-glow)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      transitionTimingFunction: {
        "out-expo": "var(--ease-out)",
      },
      scale: {
        // Press-feedback values used across the app (not in Tailwind's default scale set).
        97: "0.97",
        98: "0.98",
        102: "1.02",
      },
    },
  },
  plugins: [],
}
