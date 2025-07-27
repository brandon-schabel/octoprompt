import type { ProjectFileMap, ProjectFile } from '@promptliano/schemas'
import { $ } from 'bun'
import { XMLParser } from 'fast-xml-parser'

// Define ParsedJUnitResults type (structure based on JUnit XML)
export type ParsedJUnitResults = {
  passed: boolean
  totalTests: number
  failedTests: number
  failures: { testName: string; message: string; stackTrace?: string }[]
}

type Task = {
  title: string
  relatedTestFileId: number
}

// --- Test Agent ---
export async function runTestAgent(task: Task, currentFiles: ProjectFileMap): Promise<ProjectFile | null> {
  console.log(`Running Test Agent for task: ${task.title}`)
  // Placeholder implementation - replace with actual logic if needed
  console.log('Test Agent finished for task.')
  const testFile = task.relatedTestFileId ? currentFiles.get(task.relatedTestFileId) : undefined
  return testFile ? { ...testFile, content: testFile.content ?? '' } : null
}

// --- Test Execution Helper ---
export async function executeTests(testFilePath?: string): Promise<string> {
  console.log('Executing tests...')
  const resultsPath = './bun-test-results.xml'
  const testTarget = testFilePath ? `./${testFilePath}` : ''
  const command = `bun test ${testTarget} --reporter=junit --reporter-outfile=${resultsPath} --bail`
  try {
    await $`${command}`.quiet()
    console.log('Tests executed (passed or JUnit generated).')
    return resultsPath
  } catch (error: any) {
    if (error.exitCode !== undefined && error.exitCode !== 0) {
      console.log(`Tests failed with exit code ${error.exitCode}. JUnit file should be generated.`)
      return resultsPath
    } else {
      console.error('Failed to execute test command:', error)
      throw new Error(`Test execution failed: ${error.message}`)
    }
  }
}

// --- Test Result Parsing Helper ---
export async function parseTestResults(xmlPath: string): Promise<ParsedJUnitResults> {
  console.log(`Parsing test results from ${xmlPath}...`)
  try {
    const xmlData = Bun.file(xmlPath)
    const xmlContent = await xmlData.text()
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
    const result = parser.parse(xmlContent)

    const testsuites = result.testsuites?.testsuite
    let totalTests = 0
    let failedTests = 0
    const failures: ParsedJUnitResults['failures'] = []

    if (testsuites) {
      const suites = Array.isArray(testsuites) ? testsuites : [testsuites]
      for (const suite of suites) {
        totalTests += parseInt(suite['@_tests'] ?? '0')
        failedTests += parseInt(suite['@_failures'] ?? '0')
        const testcases = suite.testcase
        if (testcases) {
          const cases = Array.isArray(testcases) ? testcases : [testcases]
          for (const testcase of cases) {
            if (testcase.failure) {
              failures.push({
                testName: testcase['@_name'] ?? 'Unknown Test',
                message:
                  typeof testcase.failure === 'string'
                    ? testcase.failure
                    : (testcase.failure['@_message'] ?? 'No message'),
                stackTrace: typeof testcase.failure === 'object' ? testcase.failure['#text'] : undefined
              })
            }
          }
        }
      }
    }

    const passed = failedTests === 0
    console.log(`Parsing complete: ${passed ? 'Passed' : 'Failed'} (${failedTests}/${totalTests} failed)`)
    return { passed, totalTests, failedTests, failures }
  } catch (error) {
    console.error(`Failed to read or parse JUnit XML at ${xmlPath}:`, error)
    return {
      passed: false,
      totalTests: 0,
      failedTests: 0,
      failures: [{ testName: 'Parsing Error', message: `Could not parse ${xmlPath}` }]
    }
  }
}
