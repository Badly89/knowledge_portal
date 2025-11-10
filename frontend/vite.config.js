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
          title: 'Knowledge Portal',
          // Добавляем базовый тег для корректных путей в production
          inject: {
            tags: [
              {
                tag: 'base',
                attrs: {
                  href: '/'
                },
                injectTo: 'head'
              }
            ]
          }
        }
      }
    }),

    // Включаем сжатие для production
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // 10KB
    }),

    // Brotli сжатие для production
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
    }),

    process.env.ANALYZE === 'true' && visualizer({
      filename: 'dist/bundle-report.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
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

  // ✅ Ключевые настройки для production
  base: './', // или '/' если приложение развернуто в корне

  build: {
    outDir: 'dist',
    sourcemap: false, // Отключаем sourcemaps для production

    // Увеличиваем лимит для предупреждения
    chunkSizeWarningLimit: 1500,

    rollupOptions: {
      output: {
        // Оптимизация chunk naming для кэширования
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.')[1]
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return 'assets/images/[name]-[hash][extname]'
          }
          if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
            return 'assets/fonts/[name]-[hash][extname]'
          }
          if (/css/i.test(extType)) {
            return 'assets/css/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },

        // Оптимизация разделения кода
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          utils: ['axios', 'lodash', 'moment'],
          editor: ['@tinymce/tinymce-react', 'tinymce']
        }
      }
    },

    minify: 'esbuild',

    // Очистка выходной директории
    emptyOutDir: true,
  },

  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    },
    // Минификация CSS для production
    postcss: './postcss.config.js'
  },

  server: {
    port: 3005,
    host: true, // Разрешаем доступ с других устройств
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },

  // ✅ Production оптимизации
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      '@tinymce/tinymce-react'
    ],
    exclude: ['tinymce'] // TinyMCE лучше исключить
  },

  // ✅ Настройки для предзагрузки ресурсов
  preview: {
    port: 3005,
    host: true
  }
})
