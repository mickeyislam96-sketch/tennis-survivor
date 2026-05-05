import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 30s default timeout — production smoke tests can hit network and we'd
    // rather a slow test fail loudly than a fast test miss a regression.
    testTimeout: 30000,

    // Run tests serially. The smoke suite hits real production endpoints
    // and we don't want parallel calls fighting rate limiters.
    fileParallelism: false,

    // Make Node treat .mjs and .js consistently with the rest of the project.
    environment: 'node',
  },
});
