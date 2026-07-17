/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial']
      },
      colors: {
        weld: {
          bg: '#020817',
          panel: '#071426',
          panel2: '#0b1d34',
          border: '#183454',
          cyan: '#00e5ff',
          blue: '#1677ff',
          purple: '#8b5cf6',
          red: '#ff3648',
          orange: '#ff9800',
          yellow: '#ffd33d',
          green: '#00e889'
        }
      },
      boxShadow: {
        glowBlue: '0 0 28px rgba(22, 119, 255, .36)',
        glowRed: '0 0 28px rgba(255, 54, 72, .28)',
        glowGreen: '0 0 28px rgba(0, 232, 137, .26)',
        panel: '0 20px 70px rgba(0, 0, 0, .35)'
      },
      backgroundImage: {
        'radial-blue': 'radial-gradient(circle at 30% 20%, rgba(22,119,255,.22), transparent 36%), radial-gradient(circle at 80% 10%, rgba(0,229,255,.12), transparent 24%)'
      }
    }
  },
  plugins: []
};
