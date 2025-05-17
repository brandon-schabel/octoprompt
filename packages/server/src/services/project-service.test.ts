// packages/server/src/services/project-service.test.ts
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import {
    createProject,
    getProjectById,
    listProjects,
    updateProject,
    deleteProject,
    getProjectFiles,
    updateFileContent,
    resummarizeAllFiles,
    removeSummariesFromFiles,
    createProjectFileRecord,
    bulkCreateProjectFiles,
    bulkUpdateProjectFiles,
    bulkDeleteProjectFiles,
    getProjectFilesByIds,
    summarizeSingleFile,
    summarizeFiles,
    type FileSyncData
} from '@/services/project-service'
import type {
    Project,
    ProjectFile,
    CreateProjectBody,
    UpdateProjectBody,
} from 'shared/src/schemas/project.schemas'
import type { ProjectsStorage, ProjectFilesStorage } from '@/utils/storage/project-storage' // Assuming these types are exported or reconstructable
import { ApiError, LOW_MODEL_CONFIG, MEDIUM_MODEL_CONFIG } from 'shared'
import { z } from 'zod'

// In-memory stores for our mocks
let mockProjectsDb: ProjectsStorage = {}
let mockProjectFilesDbPerProject: Record<string, ProjectFilesStorage> = {}
let idCounter = 0

// --- Mocking projectStorage ---
const mockProjectStorage = {
    readProjects: async () => JSON.parse(JSON.stringify(mockProjectsDb)),
    writeProjects: async (data: ProjectsStorage) => {
        mockProjectsDb = JSON.parse(JSON.stringify(data))
        return mockProjectsDb
    },
    readProjectFiles: async (projectId: string) => {
        return JSON.parse(JSON.stringify(mockProjectFilesDbPerProject[projectId] || {}))
    },
    writeProjectFiles: async (projectId: string, data: ProjectFilesStorage) => {
        mockProjectFilesDbPerProject[projectId] = JSON.parse(JSON.stringify(data))
        return mockProjectFilesDbPerProject[projectId]
    },
    deleteProjectData: async (projectId: string) => {
        delete mockProjectFilesDbPerProject[projectId]
    },
    generateId: (prefix: string) => `${prefix}_test_${idCounter++}`,
    updateProjectFile: async (
        projectId: string,
        fileId: string,
        fileData: Partial<Omit<ProjectFile, 'updatedAt' | 'createdAt' | 'id' | 'projectId'>>
    ): Promise<ProjectFile> => {
        if (!mockProjectFilesDbPerProject[projectId] || !mockProjectFilesDbPerProject[projectId][fileId]) {
            throw new Error(`File ${fileId} not found in project ${projectId} for mock updateProjectFile`)
        }
        const existingFile = mockProjectFilesDbPerProject[projectId][fileId]
        const updatedFile: ProjectFile = {
            ...existingFile,
            ...fileData,
            summaryLastUpdatedAt: fileData.summary !== undefined ? new Date().toISOString() : existingFile.summaryLastUpdatedAt,
            updatedAt: new Date().toISOString(),
        }
        mockProjectFilesDbPerProject[projectId][fileId] = updatedFile
        return JSON.parse(JSON.stringify(updatedFile))
    },
}

mock.module('@/utils/storage/project-storage', () => ({
    projectStorage: mockProjectStorage
}))

// --- Mocking gen-ai-services ---
const mockGenerateStructuredData = mock(async ({ schema }: { schema: z.ZodSchema<any> }) => {
    if (schema.safeParse({ summary: 'Mocked AI summary' }).success) {
        return { object: { summary: 'Mocked AI summary' } }
    }
    // Fallback for other schemas if needed, or throw error if unexpected
    return { object: {} }
})
mock.module('@/services/gen-ai-services', () => ({
    generateStructuredData: mockGenerateStructuredData,
}))

// --- Mocking file-sync-service-unified ---
const mockSyncProject = mock(async (project: Project) => {
    // Simulate sync: maybe add a dummy file if none exist for resummarizeAllFiles test
    if (!mockProjectFilesDbPerProject[project.id] || Object.keys(mockProjectFilesDbPerProject[project.id]).length === 0) {
        const fileId = mockProjectStorage.generateId('file')
        mockProjectFilesDbPerProject[project.id] = {
            [fileId]: {
                id: fileId,
                projectId: project.id,
                name: 'synced-file.txt',
                path: 'synced-file.txt',
                extension: '.txt',
                size: 10,
                content: 'synced content',
                summary: null,
                summaryLastUpdatedAt: null,
                meta: '{}',
                checksum: 'checksum-synced',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
        }
    }
    return {
        added: [],
        updated: [],
        removed: [],
        unchanged: [],
        log: [],
        error: null
    }
})
mock.module('@/services/file-services/file-sync-service-unified', () => ({
    syncProject: mockSyncProject,
}))

// Helper to generate random strings for test data
const randomString = (length = 8) => Math.random().toString(36).substring(2, 2 + length)

describe('Project Service (File Storage)', () => {
    beforeEach(async () => {
        mockProjectsDb = {}
        mockProjectFilesDbPerProject = {}
        idCounter = 0
        mockGenerateStructuredData.mockClear()
        mockSyncProject.mockClear()
    })

    describe('Project CRUD', () => {
        test('createProject creates a new project', async () => {
            const input: CreateProjectBody = {
                name: `TestProject_${randomString()}`,
                path: `/path/to/${randomString()}`,
                description: 'A test project',
            }
            const project = await createProject(input)

            expect(project.id).toBeDefined()
            expect(project.name).toBe(input.name)
            expect(project.path).toBe(input.path)
            expect(project.description).toBe(input.description)
            expect(mockProjectsDb[project.id]).toEqual(project)
            expect(mockProjectFilesDbPerProject[project.id]).toEqual({}) // Initializes empty files
        })

        // test('createProject throws ApiError on ID conflict', async () => {
        //     const id = `proj_test_0` // Predictable ID
        //     mockProjectsDb[id] = { id, name: 'Preexisting', path: '/pre', createdAt: '', updatedAt: '' }
        //     idCounter = 0 // Reset counter to force collision with the *next* call to generateId

        //     const input: CreateProjectBody = { name: 'New Project', path: '/new' }
        //     // Manually set idCounter so the next generated ID is the conflicting one.
        //     // Note: generateId is called *inside* createProject.
        //     // The test for prompt-service did this by mocking generateId itself temporarily.
        //     // Here, we control the mock's internal counter.

        //     // First call to createProject will succeed and use proj_test_0
        //     await createProject({ name: 'First Project', path: '/first' });
        //     idCounter = 0; // Reset for the actual test of conflict

        //     await expect(createProject(input)).rejects.toThrow(
        //         expect.objectContaining({
        //             message: `Project ID conflict for ${id}`, // or `Project ID conflict for proj_test_0`
        //             status: 409,
        //             code: 'PROJECT_ID_CONFLICT'
        //         })
        //     );
        // });


        test('getProjectById returns project if found, null if not', async () => {
            const input: CreateProjectBody = { name: 'GetMe', path: '/get/me' }
            const created = await createProject(input)

            const found = await getProjectById(created.id)
            expect(found).toEqual(created)

            const notFound = await getProjectById('nonexistent-id')
            expect(notFound).toBeNull()
        })

        test('listProjects returns all projects sorted by updatedAt DESC', async () => {
            let all = await listProjects()
            expect(all.length).toBe(0)

            const p1 = await createProject({ name: 'P1', path: '/p1' })
            await new Promise(resolve => setTimeout(resolve, 10)) // Ensure timestamp difference
            const p2 = await createProject({ name: 'P2', path: '/p2' })

            all = await listProjects()
            expect(all.length).toBe(2)
            expect(all[0].id).toBe(p2.id) // p2 is newer
            expect(all[1].id).toBe(p1.id)
        })

        test('updateProject updates fields and returns updated project', async () => {
            const created = await createProject({ name: 'Before', path: '/old' })
            const updates: UpdateProjectBody = { name: 'After', description: 'New Desc' }
            await new Promise(resolve => setTimeout(resolve, 1))
            const updated = await updateProject(created.id, updates)

            expect(updated).toBeDefined()
            if (!updated) throw new Error("Update failed")
            expect(updated.name).toBe('After')
            expect(updated.description).toBe('New Desc')
            expect(updated.path).toBe(created.path) // Path not changed
            expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime())
            expect(mockProjectsDb[created.id]).toEqual(updated)
        })

        test('updateProject returns null if project does not exist', async () => {
            await expect(updateProject('fake-id', { name: 'X' })).resolves.toBeNull()
        })

        test('deleteProject returns true if deleted, throws if nonexistent, and removes files data', async () => {
            const project = await createProject({ name: 'DelMe', path: '/del/me' })
            mockProjectFilesDbPerProject[project.id] = { // Simulate some files
                'file_test_1': { id: 'file_test_1', projectId: project.id, name: 'f.txt', path: 'f.txt', content: '', extension: '.txt', size: 0, createdAt: '', updatedAt: '', summary: null, summaryLastUpdatedAt: null, meta: '{}', checksum: null }
            }

            expect(mockProjectsDb[project.id]).toBeDefined()
            expect(mockProjectFilesDbPerProject[project.id]).toBeDefined()

            const success = await deleteProject(project.id)
            expect(success).toBe(true)
            expect(mockProjectsDb[project.id]).toBeUndefined()
            expect(mockProjectFilesDbPerProject[project.id]).toBeUndefined()

            await expect(deleteProject('totally-fake-id'))
                .rejects.toThrow(new ApiError(404, `Project not found with ID totally-fake-id for deletion.`, 'PROJECT_NOT_FOUND'))
        })
    })

    describe('Project File Operations', () => {
        let projectId: string;

        beforeEach(async () => {
            const proj = await createProject({ name: "FileTestProj", path: "/file/test" });
            projectId = proj.id;
        });

        test('createProjectFileRecord creates a file record', async () => {
            const filePath = 'src/app.js';
            const content = 'console.log("hello");';
            const fileRecord = await createProjectFileRecord(projectId, filePath, content);

            expect(fileRecord.id).toBeDefined();
            expect(fileRecord.projectId).toBe(projectId);
            expect(fileRecord.name).toBe('app.js');
            expect(fileRecord.path).toBe(filePath); // Assuming relative path from project root
            expect(fileRecord.content).toBe(content);
            expect(fileRecord.size).toBe(Buffer.byteLength(content, 'utf8'));
            expect(mockProjectFilesDbPerProject[projectId][fileRecord.id]).toEqual(fileRecord);
        });

        test('createProjectFileRecord throws if project not found', async () => {
            await expect(createProjectFileRecord("non-existent-proj", "file.txt", ""))
                .rejects.toThrow(new ApiError(404, `Project not found with ID non-existent-proj`, 'PROJECT_NOT_FOUND'));
        });


        test('getProjectFiles returns files for a project, or null', async () => {
            let files = await getProjectFiles(projectId);
            expect(files).toEqual([]); // Starts empty

            const file1 = await createProjectFileRecord(projectId, 'file1.txt', 'content1');
            const file2 = await createProjectFileRecord(projectId, 'file2.txt', 'content2');

            files = await getProjectFiles(projectId);
            expect(files?.length).toBe(2);
            expect(files).toEqual(expect.arrayContaining([file1, file2]));

            const noFilesForThis = await getProjectFiles('nonexistent-project');
            expect(noFilesForThis).toBeNull();
        });

        test('updateFileContent updates content and size', async () => {
            const file = await createProjectFileRecord(projectId, 'update-me.txt', 'old content');
            const newContent = 'new fresh content';
            await new Promise(resolve => setTimeout(resolve, 1)); // ensure updatedAt changes

            const updatedFile = await updateFileContent(projectId, file.id, newContent);

            expect(updatedFile.content).toBe(newContent);
            expect(updatedFile.size).toBe(Buffer.byteLength(newContent, 'utf8'));
            expect(new Date(updatedFile.updatedAt).getTime()).toBeGreaterThan(new Date(file.updatedAt).getTime());
            expect(mockProjectFilesDbPerProject[projectId][file.id].content).toBe(newContent);
        });

        test('updateFileContent throws if file not found', async () => {
            await expect(updateFileContent(projectId, 'nonexistent-file-id', 'new content'))
                .rejects.toThrow(new ApiError(404, `File not found with ID nonexistent-file-id in project ${projectId} during content update.`, 'FILE_NOT_FOUND'));
        });


        test('getProjectFilesByIds fetches specific files', async () => {
            const file1 = await createProjectFileRecord(projectId, 'f1.txt', 'c1');
            const file2 = await createProjectFileRecord(projectId, 'f2.txt', 'c2');
            await createProjectFileRecord(projectId, 'f3.txt', 'c3'); // Another file not fetched

            const fetched = await getProjectFilesByIds(projectId, [file1.id, file2.id, 'non-existent-file']);
            expect(fetched.length).toBe(2);
            expect(fetched).toEqual(expect.arrayContaining([file1, file2]));
        });

        test('getProjectFilesByIds throws if project not found', async () => {
            await expect(getProjectFilesByIds("non-existent-proj", ["some-file-id"]))
                .rejects.toThrow(new ApiError(404, `Project not found with ID non-existent-proj when fetching files by IDs.`, 'PROJECT_NOT_FOUND'));
        });
    })

    describe('Bulk File Operations', () => {
        let projectId: string;

        beforeEach(async () => {
            const proj = await createProject({ name: "BulkTestProj", path: "/bulk/test" });
            projectId = proj.id;
        });

        test('bulkCreateProjectFiles creates multiple files', async () => {
            const filesToCreate: FileSyncData[] = [
                { path: 'bulk1.js', name: 'bulk1.js', extension: '.js', content: '// bulk 1', size: 9, checksum: 'cs1' },
                { path: 'sub/bulk2.ts', name: 'bulk2.ts', extension: '.ts', content: '// bulk 2', size: 9, checksum: 'cs2' },
            ];
            const created = await bulkCreateProjectFiles(projectId, filesToCreate);
            expect(created.length).toBe(2);
            expect(Object.keys(mockProjectFilesDbPerProject[projectId]).length).toBe(2);
            expect(created[0].path).toBe(filesToCreate[0].path);
            expect(created[1].content).toBe(filesToCreate[1].content);
        });

        test('bulkCreateProjectFiles skips duplicates by path', async () => {
            await bulkCreateProjectFiles(projectId, [{ path: 'duplicate.txt', name: 'duplicate.txt', extension: '.txt', content: 'original', size: 8, checksum: 'cs_orig' }]);
            const filesToCreate: FileSyncData[] = [
                { path: 'new.txt', name: 'new.txt', extension: '.txt', content: 'new', size: 3, checksum: 'cs_new' },
                { path: 'duplicate.txt', name: 'duplicate.txt', extension: '.txt', content: 'attempted duplicate', size: 20, checksum: 'cs_dup' },
            ];
            const created = await bulkCreateProjectFiles(projectId, filesToCreate);
            expect(created.length).toBe(1); // Only new.txt should be created
            expect(created[0].path).toBe('new.txt');
            expect(Object.keys(mockProjectFilesDbPerProject[projectId]).length).toBe(2); // original duplicate.txt + new.txt
            const filesInDb = Object.values(mockProjectFilesDbPerProject[projectId]);
            const originalDup = filesInDb.find(f => f.path === 'duplicate.txt');
            expect(originalDup?.content).toBe('original'); // Original content should remain
        });


        test('bulkUpdateProjectFiles updates multiple files', async () => {
            const f1 = await createProjectFileRecord(projectId, 'up1.txt', 'old1');
            const f2 = await createProjectFileRecord(projectId, 'up2.txt', 'old2');

            const updates = [
                { fileId: f1.id, data: { path: f1.path, name: f1.name, extension: f1.extension, content: 'new1', size: 4, checksum: 'cs_new1' } },
                { fileId: f2.id, data: { path: f2.path, name: f2.name, extension: f2.extension, content: 'new2', size: 4, checksum: 'cs_new2' } },
            ];
            const updatedResult = await bulkUpdateProjectFiles(projectId, updates);
            expect(updatedResult.length).toBe(2);
            expect(mockProjectFilesDbPerProject[projectId][f1.id].content).toBe('new1');
            expect(mockProjectFilesDbPerProject[projectId][f2.id].checksum).toBe('cs_new2');
        });

        test('bulkDeleteProjectFiles deletes multiple files', async () => {
            const f1 = await createProjectFileRecord(projectId, 'del1.txt', 'c1');
            const f2 = await createProjectFileRecord(projectId, 'del2.txt', 'c2');
            const f3 = await createProjectFileRecord(projectId, 'del3.txt', 'c3'); // Keep this one

            const { deletedCount } = await bulkDeleteProjectFiles(projectId, [f1.id, f2.id, 'non-existent-id']);
            expect(deletedCount).toBe(2);
            expect(mockProjectFilesDbPerProject[projectId][f1.id]).toBeUndefined();
            expect(mockProjectFilesDbPerProject[projectId][f2.id]).toBeUndefined();
            expect(mockProjectFilesDbPerProject[projectId][f3.id]).toBeDefined();
        });
    });

    describe('Summarization', () => {
        let projectId: string;
        let file1: ProjectFile;

        beforeEach(async () => {
            const proj = await createProject({ name: "SummarizeProj", path: "/summarize/test" });
            projectId = proj.id;
            file1 = await createProjectFileRecord(projectId, 'summarize-me.js', 'function hello() { console.log("world"); }');
            // Reset mock return for generateStructuredData for each test if specific return values are needed
            mockGenerateStructuredData.mockImplementation(async ({ schema }: { schema: z.ZodSchema<any> }) => {
                if (schema.safeParse({ summary: 'Mocked AI summary' }).success) {
                    return { object: { summary: 'Mocked AI summary' } };
                }
                return { object: {} };
            });
        });

        test('summarizeSingleFile successfully summarizes a file', async () => {
            const summarized = await summarizeSingleFile(file1);
            expect(summarized).toBeDefined();
            if (!summarized) throw new Error("Summarization failed");

            expect(summarized.summary).toBe('Mocked AI summary');
            expect(summarized.summaryLastUpdatedAt).toBeDefined();
            expect(mockProjectFilesDbPerProject[projectId][file1.id].summary).toBe('Mocked AI summary');
            expect(mockGenerateStructuredData).toHaveBeenCalledTimes(1);
        });

        test('summarizeSingleFile returns null for empty file content', async () => {
            const emptyFile = await createProjectFileRecord(projectId, 'empty.txt', '');
            const summarized = await summarizeSingleFile(emptyFile);
            expect(summarized).toBeNull();
            expect(mockProjectFilesDbPerProject[projectId][emptyFile.id].summary).toBeNull();
            expect(mockGenerateStructuredData).not.toHaveBeenCalled();
        });

        test('summarizeSingleFile throws ApiError if AI model not configured (simulated)', async () => {
            // Simulate model not configured by making generateStructuredData throw that error
            mockGenerateStructuredData.mockRejectedValueOnce(
                new ApiError(500, `AI Model not configured...`, 'AI_MODEL_NOT_CONFIGURED')
            );
            await expect(summarizeSingleFile(file1))
                .rejects.toThrow(new ApiError(500, `AI Model not configured...`, 'AI_MODEL_NOT_CONFIGURED'));
        });

        test('summarizeSingleFile throws ApiError on AI failure', async () => {
            mockGenerateStructuredData.mockRejectedValueOnce(new Error('AI provider exploded'));
            await expect(summarizeSingleFile(file1))
                .rejects.toThrow(new ApiError(500, `Failed to summarize file ${file1.path} in project ${projectId}. Reason: AI provider exploded`, 'FILE_SUMMARIZE_FAILED'));
        });


        test('summarizeFiles processes multiple files', async () => {
            const file2 = await createProjectFileRecord(projectId, 'another.js', 'let x = 10;');
            const emptyFile = await createProjectFileRecord(projectId, 'empty-too.txt', '');

            const result = await summarizeFiles(projectId, [file1.id, file2.id, emptyFile.id]);
            expect(result.included).toBe(2); // file1 and file2
            expect(result.skipped).toBe(1); // emptyFile
            expect(result.updatedFiles.length).toBe(2);
            expect(mockProjectFilesDbPerProject[projectId][file1.id].summary).toBe('Mocked AI summary');
            expect(mockProjectFilesDbPerProject[projectId][file2.id].summary).toBe('Mocked AI summary');
            expect(mockProjectFilesDbPerProject[projectId][emptyFile.id].summary).toBeNull();
            expect(mockGenerateStructuredData).toHaveBeenCalledTimes(2); // For file1 and file2
        });

        test('removeSummariesFromFiles clears summaries', async () => {
            // First, summarize a file so there's something to remove
            await summarizeSingleFile(file1);
            expect(mockProjectFilesDbPerProject[projectId][file1.id].summary).toBe('Mocked AI summary');
            expect(mockProjectFilesDbPerProject[projectId][file1.id].summaryLastUpdatedAt).toBeDefined();

            const fileWithNoSummary = await createProjectFileRecord(projectId, 'no-summary.txt', 'content');

            const { removedCount, message } = await removeSummariesFromFiles(projectId, [file1.id, fileWithNoSummary.id, 'non-existent-file']);
            expect(removedCount).toBe(1);
            expect(message).toBe('Removed summaries from 1 files.');
            expect(mockProjectFilesDbPerProject[projectId][file1.id].summary).toBeNull();
            expect(mockProjectFilesDbPerProject[projectId][file1.id].summaryLastUpdatedAt).toBeNull();
            expect(mockProjectFilesDbPerProject[projectId][fileWithNoSummary.id].summary).toBeNull(); // Was already null
        });

        test('resummarizeAllFiles calls sync and then summarizeFiles', async () => {
            // mockSyncProject ensures a file ('synced-file.txt') is "added" if none exist
            // We'll create an empty project for this test to ensure syncProject adds one.
            const newProj = await createProject({ name: "ResummarizeTest", path: "/resummarize" });
            mockProjectFilesDbPerProject[newProj.id] = {}; // Ensure it's empty initially

            await resummarizeAllFiles(newProj.id);

            expect(mockSyncProject).toHaveBeenCalledWith(expect.objectContaining({ id: newProj.id }));
            // Check if summarizeSingleFile (via summarizeFiles) was called for the synced file
            // This depends on the mockSyncProject behavior. Our mock adds 'synced-file.txt'
            const syncedFileInDb = Object.values(mockProjectFilesDbPerProject[newProj.id] || {}).find(f => f.name === 'synced-file.txt');
            expect(syncedFileInDb).toBeDefined();
            expect(syncedFileInDb?.summary).toBe('Mocked AI summary'); // It should have been summarized
            expect(mockGenerateStructuredData).toHaveBeenCalledTimes(1); // For the one synced file
        });

        test('resummarizeAllFiles handles project not found', async () => {
            await expect(resummarizeAllFiles("non-existent-project"))
                .rejects.toThrow(new ApiError(404, `Project not found with ID non-existent-project for resummarize all.`, 'PROJECT_NOT_FOUND'));
        });

        test('resummarizeAllFiles does nothing if no files after sync (and no error)', async () => {
            const newProj = await createProject({ name: "ResummarizeEmptyTest", path: "/resummarize-empty" });
            mockProjectFilesDbPerProject[newProj.id] = {}; // Ensure it's empty

            // Adjust mockSyncProject to simulate it finding no files
            mockSyncProject.mockImplementationOnce(async () => {
                mockProjectFilesDbPerProject[newProj.id] = {}; // Ensure still empty after sync
                return { added: [], updated: [], removed: [], unchanged: [], log: [], error: null };
            });

            await resummarizeAllFiles(newProj.id);

            expect(mockSyncProject).toHaveBeenCalledWith(expect.objectContaining({ id: newProj.id }));
            // summarizeFiles (and thus generateStructuredData) should not be called if no files.
            expect(mockGenerateStructuredData).not.toHaveBeenCalled();
            // Check console.warn was called (harder to test directly without spyOn console)
            // but we can assert no error was thrown and files remain empty and unsummarized.
            expect(mockProjectFilesDbPerProject[newProj.id]).toEqual({});
        });

    })
})