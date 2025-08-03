import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    components: 'src/components/index.ts',
    utils: 'src/utils/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  external: [
    'react',
    'react-dom',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
    '@radix-ui/react-dialog',
    '@radix-ui/react-dropdown-menu',
    '@radix-ui/react-label',
    '@radix-ui/react-separator',
    '@radix-ui/react-slot',
    '@radix-ui/react-tabs',
    '@radix-ui/react-tooltip'
  ],
  clean: true,
  minify: process.env.NODE_ENV === 'production',
  treeshake: true,
  splitting: true,
  esbuildOptions(options) {
    options.jsx = 'automatic'
  }
})
