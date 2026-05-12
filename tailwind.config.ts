import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#000000',
          secondary: '#0A0A0A',
          tertiary: '#141414',
        },
        fg: {
          primary: '#FFFFFF',
          secondary: '#A0A0A0',
          tertiary: '#5C5C5C',
        },
        border: {
          default: '#2A2A2A',
          hover: '#FFFFFF',
        },
        status: {
          connected: '#4ADE80',
          ghost: '#FBBF24',
          orphan: '#F87171',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Geist', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'fade-in-slow': 'fade-in 0.6s ease forwards',
      },
    },
  },
  plugins: [],
}

export default config
