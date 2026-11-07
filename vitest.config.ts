import { defineConfig } from 'vitest/config'

/**
 * Configuração do Vitest.
 *
 * Separada do `vite.config.ts` para que os testes não carreguem o plugin PWA.
 * Ambiente `node`: o motor é puro e a persistência usa `fake-indexeddb`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // Os testes de componente declaram `// @vitest-environment jsdom` no
    // próprio arquivo; o restante da suíte continua em Node puro.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
    // Garante o build de desenvolvimento do React (`React.act`), mesmo em
    // máquinas com NODE_ENV=production no ambiente.
    env: { NODE_ENV: 'test' },
  },
})
