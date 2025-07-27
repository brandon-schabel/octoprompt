import type { ProjectFile } from '@promptliano/schemas'
import {
  gatherAliasesFromTsconfigs,
  getRecursiveImports,
  buildTsconfigAliasMap,
  type TsconfigCache
} from './import-resolver'
import { describe, it, expect, beforeAll } from 'bun:test'

describe('Import Resolver', () => {
  const projectRoot = '/Users/brandon/Programming/prompt-labs-ai/client'

  // Mock files
  const tsconfig: ProjectFile = {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    projectId: 1,
    name: 'tsconfig.json',
    id: 'tsconfig',
    path: `${projectRoot}/tsconfig.json`,
    content: JSON.stringify({
      files: [],
      references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@/*': ['./src/*']
        }
      }
    })
  }

  const tsconfigServer: ProjectFile = {
    id: 'tsconfig-server',
    path: `${projectRoot}/server/tsconfig.json`,
    content: JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@server/*': ['./server/src/*']
        }
      }
    })
  }

  const noImportFile: ProjectFile = {
    id: 'no-import',
    path: `${projectRoot}/src/utils/no-import.ts`,
    content: `export const noop = () => {};`
  }

  const relativeImportFile: ProjectFile = {
    id: 'relative-import',
    path: `${projectRoot}/src/utils/relative-import.ts`,
    content: `import { noop } from "./no-import";\nexport const doSomething = noop;`
  }

  const missingImportFile: ProjectFile = {
    id: 'missing-import',
    path: `${projectRoot}/src/utils/missing-import.ts`,
    content: `import { something } from "./not-exist";`
  }

  const menubarFile: ProjectFile = {
    id: 'menubar',
    path: `${projectRoot}/src/components/ui/menubar.tsx`,
    content: `export function Menubar() { return <div>Menubar</div>; }`
  }

  const dialogFile: ProjectFile = {
    id: 'dialog',
    path: `${projectRoot}/src/components/ui/dialog.tsx`,
    content: `export function Dialog() { return <div>Dialog</div>; }`
  }

  const projectListFile: ProjectFile = {
    id: 'project-list',
    path: `${projectRoot}/src/components/projects/project-list.tsx`,
    content: `export function ProjectList() { return <div>ProjectList</div>; }`
  }

  const projectDialogFile: ProjectFile = {
    id: 'project-dialog',
    path: `${projectRoot}/src/components/projects/project-dialog.tsx`,
    content: `export function ProjectDialog() { return <div>ProjectDialog</div>; }`
  }

  const hooksFile: ProjectFile = {
    id: 'hooks-api',
    path: `${projectRoot}/src/hooks/api/use-projects-api.ts`,
    content: `export function useGetProjects() {}; export function useDeleteProject() {};`
  }

  const globalStateHookFile: ProjectFile = {
    id: 'global-state',
    path: `${projectRoot}/src/hooks/use-global-state.ts`,
    content: `export function useGlobalState() { return { state: { projectsPage:{} }, updateState: () => {} } }`
  }

  const appMenubarFile: ProjectFile = {
    id: 'app-menubar',
    path: `${projectRoot}/src/components/app-menubar.tsx`,
    content: `
      import * as React from "react"
      import {
        Menubar,
        MenubarContent,
        MenubarItem,
        MenubarMenu,
        MenubarSeparator,
        MenubarShortcut,
        MenubarTrigger,
      } from "@/components/ui/menubar"
      import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
      } from "@ui"
      import { ProjectList } from "@/components/projects/project-list"
      import { useGetProjects, useDeleteProject } from "@/hooks/api/use-projects-api"
      import { useGlobalState } from "@/hooks/use-global-state"
      import { useNavigate } from "@tanstack/react-router"
      import { ProjectDialog } from "@/components/projects/project-dialog"
      import { useHotkeys } from 'react-hotkeys-hook'

      export function AppMenubar() {}
    `
  }

  const cycAFile: ProjectFile = {
    id: 'cyc-a',
    path: `${projectRoot}/src/cyclical/a.ts`,
    content: `import { b } from "./b"; export const a = b;`
  }
  const cycBFile: ProjectFile = {
    id: 'cyc-b',
    path: `${projectRoot}/src/cyclical/b.ts`,
    content: `import { a } from "./a"; export const b = a;`
  }

  const serverUtilFile: ProjectFile = {
    id: 'server-util',
    path: `${projectRoot}/server/src/utils/server-util.ts`,
    content: `export function serverUtil() {}`
  }

  const serverImportFile: ProjectFile = {
    id: 'server-import',
    path: `${projectRoot}/server/src/index.ts`,
    content: `import { serverUtil } from "@server/utils/server-util"; export const main = serverUtil;`
  }

  const allFiles: ProjectFile[] = [
    tsconfig,
    tsconfigServer,
    noImportFile,
    relativeImportFile,
    missingImportFile,
    menubarFile,
    dialogFile,
    projectListFile,
    projectDialogFile,
    hooksFile,
    globalStateHookFile,
    appMenubarFile,
    cycAFile,
    cycBFile,
    serverUtilFile,
    serverImportFile
  ]

  let tsconfigCache: TsconfigCache

  beforeAll(() => {
    tsconfigCache = buildTsconfigAliasMap(allFiles)
  })

  it('should gather aliases from all tsconfigs', () => {
    const aliases = gatherAliasesFromTsconfigs(allFiles, projectRoot)
    expect(aliases['@/*']).toEqual(['./src/*'])
    expect(aliases['@server/*']).toEqual(['./server/src/*'])
  })

  it('should return no imports for a file with no imports', () => {
    const result = getRecursiveImports('no-import', allFiles, tsconfigCache)
    expect(result).toEqual([])
  })

  it('should resolve a relative import', () => {
    const result = getRecursiveImports('relative-import', allFiles, tsconfigCache)
    expect(result).toEqual(['no-import'])
  })

  it('should skip missing files', () => {
    const result = getRecursiveImports('missing-import', allFiles, tsconfigCache)
    expect(result).toEqual([])
  })

  it('should resolve alias imports (as in the app-menubar example)', () => {
    const result = getRecursiveImports('app-menubar', allFiles, tsconfigCache)
    const expected = ['menubar', 'project-list', 'hooks-api', 'global-state', 'project-dialog']
    expect(new Set(result)).toEqual(new Set(expected))
  })

  it('should not include package imports', () => {
    const result = getRecursiveImports('app-menubar', allFiles, tsconfigCache)
    expect(result).not.toContain('@tanstack/react-router')
    expect(result).not.toContain('react-hotkeys-hook')
  })

  it('should handle cyclical imports without infinite loops', () => {
    const resultA = getRecursiveImports('cyc-a', allFiles, tsconfigCache)
    const resultB = getRecursiveImports('cyc-b', allFiles, tsconfigCache)
    expect(new Set(resultA)).toEqual(new Set(['cyc-b']))
    expect(new Set(resultB)).toEqual(new Set(['cyc-a']))
  })

  // it('should resolve server aliases as well', () => {
  //     const result = getRecursiveImports('server-import', allFiles, tsconfigCache);
  //     expect(result).toEqual(['server-util']);
  // })

  it('simulates an auto-select imports scenario', () => {
    const autoSelectImports = true
    const clickedFileId = 'app-menubar'
    const importedFiles = getRecursiveImports(clickedFileId, allFiles, tsconfigCache)
    if (autoSelectImports) {
      const expected = ['menubar', 'project-list', 'hooks-api', 'global-state', 'project-dialog']
      expect(new Set(importedFiles)).toEqual(new Set(expected))
    }
  })
})
