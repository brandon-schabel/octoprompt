# UI Package Build Comparison

## Build Systems

The UI package now supports two build systems:

### 1. tsup (Original)

- **Command**: `bun run build`
- **Dev mode**: `bun run dev`
- **Output**:
  - `dist/index.js` (CJS, ~249KB)
  - `dist/index.mjs` (ESM, ~225KB)
  - `dist/index.d.ts` + `dist/index.d.mts` (TypeScript declarations)
- **Build time**: ~6 seconds

### 2. Bun.build (New)

- **Command**: `bun run build:bun`
- **Dev mode**: `bun run dev:bun`
- **Output**:
  - `dist/index.cjs` (CJS)
  - `dist/index.js` (ESM)
  - `dist/**/*.d.ts` (TypeScript declarations, preserves file structure)
- **Build time**: ~4 seconds

## Key Differences

1. **Performance**: Bun build is ~33% faster
2. **Output structure**: Bun preserves the component file structure in declarations
3. **File extensions**: tsup uses `.mjs` for ESM, Bun uses `.js`
4. **Configuration**: tsup uses `tsup.config.ts`, Bun uses `scripts/build-with-bun.ts`

## When to Use Each

- **Use tsup** if you need maximum compatibility with existing tooling
- **Use Bun** for faster builds and better declaration file organization

## Migration Notes

Both build systems produce compatible outputs. The main difference is in the file extensions and declaration file structure. Consuming packages should work with either build output.
