import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from '../packages/server/src/app'; // Adjust path as necessary
import serverPackageJson from '../packages/server/package.json';

async function generateSpec() {
    try {
        console.log('Generating OpenAPI specification...');
        const document = app.getOpenAPIDocument({
            openapi: '3.1.0',
            info: {
                description: 'OctoPrompt OpenAPI Server Spec',
                version: serverPackageJson.version,
                title: serverPackageJson.name
            }
        });
        const outputPath = join(process.cwd(), 'openapi.json');
        await writeFile(outputPath, JSON.stringify(document, null, 2));
        console.log(`OpenAPI specification successfully written to ${outputPath}`);
    } catch (error) {
        console.error('Error generating OpenAPI specification:', error);
        process.exit(1);
    }
}

generateSpec(); 