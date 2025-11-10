import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHtmlPlugin } from 'vite-plugin-html'
import compression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          '@babel/plugin-transform-runtime',
          '@babel/plugin-syntax-dynamic-import'
        ],
      }
    }),

    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          title: 'Your App Title',
        }
      }
    }),

    // Оставляем только gzip для разработки
    process.env.NODE_ENV === 'production' && compression({
      algorithm: 'gzip',
      threshold: 8192,
    }),

    process.env.ANALYZE && visualizer({
      filename: 'dist/bundle-report.html',
      open: false,
    })
  ].filter(Boolean),

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@pages': path.resolve(__dirname, 'src/pages')
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,

    // Увеличиваем лимит для предупреждения
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        chunkFileNames: 'static/js/[name]-[hash].js',
        entryFileNames: 'static/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.')[1]
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return 'static/images/[name]-[hash][extname]'
          }
          if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
            return 'static/fonts/[name]-[hash][extname]'
          }
          if (/css/i.test(extType)) {
            return 'static/css/[name]-[hash][extname]'
          }
          return 'static/assets/[name]-[hash][extname]'
        },
      }
    },

    minify: 'esbuild',
  },

  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    },
  },

  server: {
    port: 3005,
    proxy: {
      // Прокси для API запросов
      '/api': {
        target: 'http://localhost:6500', // ваш бэкенд
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      },
      // Можно добавить другие API endpoints
      '/uploads': {
        target: 'http://localhost:6500',
        changeOrigin: true
      }
    }
  },

  optimizeDeps: {
    // Предварительно bundle крупные зависимости
    // include: [
    //   'react',
    //   'react-dom',
    //   'react-router-dom',
    //   // добавьте другие крупные зависимости
    // ],
    // Исключаем из предварительной обработки
    exclude: []
  }
})