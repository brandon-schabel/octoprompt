import { defaultPlugins } from '@hey-api/openapi-ts'

export default {
  input: 'http://localhost:3147/doc',
  output: './packages/client/src/generated',
  plugins: [...defaultPlugins, '@hey-api/client-fetch', '@tanstack/react-query'],
  clean: true
}
