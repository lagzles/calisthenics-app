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
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
