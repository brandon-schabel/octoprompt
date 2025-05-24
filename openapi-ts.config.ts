import { defaultPlugins, defineConfig } from '@hey-api/openapi-ts'
// import { server } from 'typescript'; // This import seems unused, consider removing if not needed.

const isProduction = import.meta.env.ENVIRONMENT === 'prod';
const serverPort = isProduction ? 3579 : 3147;
// 8000 is python fastapi server port
// const serverPort = isProduction ? 3579 : 8000;
// uncomment to use server-side openapi spec
const openApiDevUrl = `http://localhost:${serverPort}/doc`;

// IIFE to ping the server in development mode before proceeding
(async () => {
  if (!isProduction) {
    const healthCheck = `http://localhost:${serverPort}/api/health`;
    console.log(`Attempting to ping development server at ${healthCheck}...`);
    try {
      const response = await fetch(healthCheck);
      if (!response.ok || (await response.json()).success !== true) {
        throw new Error(`Server ping failed with status ${response.status}`);
      }
      console.log('Development server responded to ping successfully.');
    } catch (error) {
      console.error(`Error pinging development server: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`Please ensure the backend server is running on port ${serverPort} and the /ping endpoint is available.`);
      // Optionally, exit the process if the server is not available, to prevent openapi-ts from running with a stale or incorrect spec.
      // process.exit(1);
    }
  }
})();

// console.log(`Using OpenAPI URL: ${openApiUrl} (ENVIRONMENT: ${import.meta.env.ENVIRONMENT})`);

export default defineConfig({
  // input: openApiUrl,
  input: isProduction ? './openapi.json' : openApiDevUrl,
  // output: './packages/client/src/generated',
  output: './packages/client/src/generated',
  plugins: [...defaultPlugins, '@hey-api/client-fetch', '@tanstack/react-query'],
  // clean: true

})
