import { defineConfig } from 'vitest/config';

// TEST LAYER 7 — universal component tests, WEB-RENDERER arm.
// RN primitives are rendered through react-native-web to the DOM (jsdom) and asserted with
// testing-library. This catches RNW divergence the day it appears (Build Plan §5, layer 7).
// The native-renderer arm (react-test-renderer) is a tracked follow-up.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { 'react-native': 'react-native-web' },
  },
});
