#!/usr/bin/env bun

/**
 * Integration test demonstrating the large file summarization feature
 * This script creates test files of various sizes and attempts to summarize them
 */

import { createProject, summarizeFiles, getProjectFiles, deleteProject } from '@octoprompt/services'
import { projectStorage } from '@octoprompt/storage'
import { MAX_FILE_SIZE_FOR_SUMMARY, MAX_TOKENS_FOR_SUMMARY, CHARS_PER_TOKEN_ESTIMATE } from '@octoprompt/schemas'
import * as fs from 'fs/promises'
import * as path from 'path'

async function main() {
  console.log('🧪 Testing Large File Summarization Feature\n')

  // Create a test directory
  const testDir = path.join(process.cwd(), 'test-large-files-' + Date.now())
  await fs.mkdir(testDir, { recursive: true })

  try {
    // Create test files of various sizes
    const files = [
      {
        name: 'small-file.ts',
        content: `// Small file that should be summarized normally
export function hello() {
  return "Hello, World!";
}

export function goodbye() {
  return "Goodbye!";
}`,
        expectedResult: 'should be summarized'
      },
      {
        name: 'empty-file.ts',
        content: '   \n\n   ',
        expectedResult: 'should be skipped (empty)'
      },
      {
        name: 'large-file.ts',
        content: '// This is a large file\n' + 'x'.repeat(MAX_FILE_SIZE_FOR_SUMMARY + 1000),
        expectedResult: 'should be skipped (too large)'
      },
      {
        name: 'long-content-file.ts',
        content:
          '// File with content exceeding token limit\n' +
          'const data = "' +
          'a'.repeat(MAX_TOKENS_FOR_SUMMARY * CHARS_PER_TOKEN_ESTIMATE + 1000) +
          '";',
        expectedResult: 'should be summarized with truncation'
      }
    ]

    // Write test files
    console.log('📝 Creating test files...')
    for (const file of files) {
      const filePath = path.join(testDir, file.name)
      await fs.writeFile(filePath, file.content)
      console.log(`  - ${file.name} (${file.content.length} bytes) - ${file.expectedResult}`)
    }

    // Create project
    console.log('\n📁 Creating project...')
    const project = await createProject({
      name: 'Large File Test Project',
      path: testDir
    })
    console.log(`  Project created with ID: ${project.id}`)

    // Wait for sync to complete
    console.log('\n🔄 Waiting for file sync...')
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Get all project files
    const projectFiles = await getProjectFiles(project.id)
    console.log(`  Found ${projectFiles.length} files in project`)

    // Display file information
    console.log('\n📊 File Information:')
    for (const file of projectFiles) {
      const sizeKB = (file.size / 1024).toFixed(2)
      const exceedsLimit = file.size > MAX_FILE_SIZE_FOR_SUMMARY
      console.log(`  - ${file.name}: ${sizeKB} KB ${exceedsLimit ? '⚠️  (exceeds limit)' : '✅'}`)
    }

    // Attempt to summarize all files
    console.log('\n🤖 Summarizing files...')
    const fileIds = projectFiles.map((f) => f.id)
    const result = await summarizeFiles(project.id, fileIds)

    // Display results
    console.log('\n📈 Summarization Results:')
    console.log(`  ✅ Successfully summarized: ${result.included}`)
    console.log(`  ⏭️  Skipped: ${result.skipped}`)
    if (result.skippedReasons) {
      console.log(`     - Empty files: ${result.skippedReasons.empty}`)
      console.log(`     - Too large: ${result.skippedReasons.tooLarge}`)
      console.log(`     - Errors: ${result.skippedReasons.errors}`)
    }

    // Check which files were summarized
    console.log('\n📝 Summary Status:')
    const updatedFiles = await getProjectFiles(project.id)
    for (const file of updatedFiles) {
      if (file.summary) {
        const truncated = file.summary.includes('[Note: File was truncated')
        console.log(`  ✅ ${file.name}: ${truncated ? 'Summarized (truncated)' : 'Summarized'}`)
        console.log(`     "${file.summary.substring(0, 100)}..."`)
      } else {
        const reason =
          file.size > MAX_FILE_SIZE_FOR_SUMMARY ? 'too large' : file.content.trim() === '' ? 'empty' : 'unknown'
        console.log(`  ❌ ${file.name}: Not summarized (${reason})`)
      }
    }

    // Cleanup
    console.log('\n🧹 Cleaning up...')
    await deleteProject(project.id)
  } finally {
    // Remove test directory
    await fs.rm(testDir, { recursive: true, force: true })
  }

  console.log('\n✅ Test completed successfully!')
}

// Run the test
main().catch(console.error)
