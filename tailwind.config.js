/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['"AR One Sans"', 'sans-serif'],
            },
            colors: {
                gray: {
                    50: '#faf9f5',
                    100: '#f3f4f1',
                    200: '#e5e6e1',
                    300: '#d1d2cd',
                    400: '#9a9b99',
                    500: '#767775',
                    600: '#5e5f5d',
                    700: '#4a4b49',
                    800: '#3a3b39',
                    900: '#363735',
                    950: '#262624',
                },
                primary: {
                    400: '#e68e70',
                    500: '#d97757',
                    600: '#c56a4d',
                    900: '#5e2819',
                },
                blue: {
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    900: '#1e3a8a',
                },
                green: {
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                    900: '#064e3b',
                },
                red: {
                    400: '#f87171',
                    500: '#ef4444',
                    900: '#7f1d1d',
                },
                yellow: {
                    400: '#fbbf24',
                    900: '#78350f',
                }
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'float-delayed': 'float 6s ease-in-out 3s infinite',
                'float-slow': 'floatSlow 8s ease-in-out infinite',
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
                'grow-width': 'growWidth 1.5s ease-out forwards',
                'scroll-left': 'scrollLeft 20s linear infinite',
                'wiggle': 'wiggle 3s ease-in-out infinite',
                'drift-left': 'driftLeft 4s ease-in-out infinite alternate',
                'drift-right': 'driftRight 4s ease-in-out infinite alternate',
                'burn': 'burn 0.2s ease-in-out infinite alternate',
                'emit': 'emit 1.5s linear infinite',
                'draw': 'draw 2s ease-out forwards',
                'draw-delayed': 'draw 2s ease-out 1s forwards',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-20px)' },
                },
                floatSlow: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                growWidth: {
                    '0%': { width: '0%' },
                    '100%': { width: 'var(--target-width)' },
                },
                scrollLeft: {
                    '0%': { transform: 'translateX(0)' },
                    '100%': { transform: 'translateX(-50%)' },
                },
                wiggle: {
                    '0%, 100%': { transform: 'rotate(-3deg)' },
                    '50%': { transform: 'rotate(3deg)' },
                },
                driftLeft: {
                    '0%': { transform: 'translateX(0)' },
                    '100%': { transform: 'translateX(-10px)' },
                },
                driftRight: {
                    '0%': { transform: 'translateX(0)' },
                    '100%': { transform: 'translateX(10px)' },
                },
                burn: {
                    '0%': { opacity: '1', transform: 'scaleY(1)' },
                    '100%': { opacity: '0.6', transform: 'scaleY(0.9)' },
                },
                emit: {
                    '0%': { opacity: '1', transform: 'translateX(0)' },
                    '100%': { opacity: '0', transform: 'translateX(10px)' }
                },
                draw: {
                    '0%': { strokeDashoffset: '1000' },
                    '100%': { strokeDashoffset: '0' }
                },
                shimmer: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' }
                }
            }
        }
    },
    plugins: [],
}
