# Asset Generator

The Asset Generator is a powerful feature in OctoPrompt that allows you to quickly generate high-quality code assets using AI assistance.

## Overview

The Asset Generator provides templates and AI-powered generation for common development assets:

- **README Files** - Comprehensive project documentation
- **React Components** - TypeScript components with best practices
- **Test Suites** - Bun test framework test files
- **Configuration Files** - Tool-specific config files
- **API Routes** - Hono API routes with validation
- **Zod Schemas** - Type-safe validation schemas

## How to Use

### Accessing the Asset Generator

1. Navigate to the **Assets** tab in the sidebar (sparkles icon)
2. Or use the keyboard shortcut: `Cmd/Ctrl + G`
3. Or access via Command Palette (`Cmd/Ctrl + K`) and select "Generate Assets"

### Generating an Asset

1. Select the type of asset you want to generate
2. Fill in the required information:

   - **Name** - The name of your asset (e.g., component name, project name)
   - **Description** - What the asset should do or contain
   - **Additional Context** - Tech stack, props, or other specific requirements

3. Click **Generate** to create your asset
4. Preview and edit the generated content
5. Copy to clipboard or download the file

### Recent Generations

The Asset Generator keeps track of your recent generations for easy access:

- View up to 10 recent generations
- Copy content to clipboard
- Download as files
- Delete unwanted generations

## Asset Types

### README Generator

Creates comprehensive README files with:

- Project overview
- Installation instructions
- Usage examples
- API documentation (if applicable)
- Contributing guidelines
- License information

### React Component Generator

Generates React components with:

- TypeScript interfaces
- Proper imports
- React best practices
- Prop validation
- Clean, reusable code

### Test Suite Generator

Creates test files with:

- Bun test framework syntax
- Describe blocks
- Multiple test cases
- Edge case handling
- Mock data setup

### Configuration File Generator

Generates config files for:

- TypeScript (tsconfig.json)
- Prettier
- ESLint
- Package.json
- And more...

### API Route Generator

Creates Hono API routes with:

- OpenAPI specifications
- Zod validation schemas
- Error handling
- TypeScript types
- RESTful conventions

### Zod Schema Generator

Generates validation schemas with:

- Proper validation rules
- Error messages
- TypeScript type inference
- OpenAPI documentation

## Tips

- Be specific in your descriptions for better results
- Use the preview to make adjustments before copying/downloading
- Generated content serves as a starting point - customize as needed
- Recent generations are stored locally in your browser

## Technical Details

The Asset Generator uses:

- AI models for intelligent code generation
- Structured output schemas for consistent results
- Monaco Editor for syntax highlighting and editing
- Local storage for recent generations
