import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'node:path'
import { existsSync, readFileSync, statSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { execSync } from 'node:child_process'
import pkg from './package.json'

const getGitCommitDate = () => {
  try {
    return execSync('git log -1 --format=%cd --date=short').toString().trim()
  } catch {
    return ''
  }
}

/**
 * Dev-only middleware that serves the repo's `specs` directory at
 * `/specs`. This lets the home-page samples (and their templates)
 * load the CURRENT working-tree content instead of the published GitHub
 * `main` branch, which may still hold legacy-format files.
 */
function serveLocalSpecs(): Plugin {
  const specsRoot = resolve(__dirname, '..', '..', 'specs')
  return {
    name: 'serve-local-specs',
    configureServer(server) {
      server.middlewares.use('/specs', (req, res, next) => {
        try {
          const urlPath = (req.url || '').replace(/\?.*$/, '')
          const abs = resolve(specsRoot, '.' + urlPath)
          if (abs.startsWith(specsRoot) && existsSync(abs) && statSync(abs).isFile()) {
            let mime = 'text/markdown; charset=utf-8'
            if (abs.endsWith('.js') || abs.endsWith('.mjs')) {
              mime = 'application/javascript; charset=utf-8'
            } else if (abs.endsWith('.css')) {
              mime = 'text/css; charset=utf-8'
            } else if (abs.endsWith('.json')) {
              mime = 'application/json; charset=utf-8'
            } else if (abs.endsWith('.html')) {
              mime = 'text/html; charset=utf-8'
            }
            res.setHeader('Content-Type', mime)
            res.setHeader('Cache-Control', 'no-store')
            res.end(readFileSync(abs, 'utf8'))
            return
          }
        } catch {
          /* fall through */
        }
        next()
      })
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE || '/innfo/app/',
  plugins: [vue(), serveLocalSpecs()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_DATE__: JSON.stringify(getGitCommitDate()),
  },
  server: {
    fs: {
      allow: [
        resolve(__dirname, '..', '..', '..'),
      ],
    },
  },
  resolve: {
    conditions: ['browser'],
    alias: {
      '@': resolve(__dirname, 'src'),
      '@cognnitive/innfo-core/legacy': resolve(
        __dirname,
        '../../packages/innfo-core/src/legacy/detect.ts',
      ),
      '@cognnitive/innfo-core': resolve(__dirname, '../../packages/innfo-core/src/browser.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    clearMocks: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.d.ts',
        '*.config.ts',
      ],
      // Ratchet thresholds: set a few points below the measured baseline
      // (2026-08-07: lines 73.1%, branches 74.12%, funcs 57.31%, stmts 73.1%)
      // so CI fails on regression, not on first run.
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 55,
        statements: 70,
      },
    },
  },
})
