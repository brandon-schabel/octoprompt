import { describe, test, expect, beforeEach } from "bun:test";
import { db } from "@db";
import {
    createPrompt, addPromptToProject, removePromptFromProject,
    getPromptById, listAllPrompts, listPromptsByProject,
    updatePrompt, deletePrompt
} from "@/services/prompt-service";

import { schema, CreatePromptBody, UpdatePromptBody } from "shared";
import { randomString } from "./test-utils";
import { eq } from "drizzle-orm";

describe("Prompt Service", () => {
    let defaultProjectId: string;

    beforeEach(async () => {
        // Create a default project for tests that don't need a specific one.
        const [project] = await db.insert(schema.projects).values({
            name: `TestProject_${randomString()}`,
            path: `/test/path_${randomString()}`,
        }).returning();
        defaultProjectId = project.id;
    });

    test("createPrompt inserts a new prompt", async () => {
        const input: CreatePromptBody = {
            projectId: defaultProjectId,
            name: `TestPrompt_${randomString()}`,
            content: "Some prompt content",
        };
        const created = await createPrompt(input);
        expect(created.id).toBeDefined();
        expect(created.name).toBe(input.name);

        // Verify by direct DB query
        const row = await db.query.prompts.findFirst({
            where: (p, { eq }) => eq(p.id, created.id),
        });
        expect(row).not.toBeUndefined();
        expect(row!.content).toBe("Some prompt content");
    });

    test("addPromptToProject then removePromptFromProject associates/unassociates prompt", async () => {
        // 1) Create a prompt
        const prompt = await createPrompt({
            projectId: defaultProjectId,
            name: "AssocTest",
            content: "Associated test content"
        });

        // 2) Insert a project
        const [project] = await db.insert(schema.projects).values({
            name: "ProjForPrompt",
            path: "/fake/path",
            description: "Test proj",
        }).returning();

        // 3) Associate the prompt with the project
        await addPromptToProject(prompt.id, project.id);

        // Check in `prompt_projects` table
        const row = await db.select()
            .from(schema.promptProjects)
            .where((pp) => eq(pp.promptId, prompt.id))
            .all();
        expect(row.length).toBe(1);
        expect(row[0].projectId).toBe(project.id);

        // 4) Remove the association
        await removePromptFromProject(prompt.id, project.id);
        const afterRemoval = await db.select()
            .from(schema.promptProjects)
            .where((pp) => eq(pp.promptId, prompt.id))
            .all();
        expect(afterRemoval.length).toBe(0);
    });

    test("getPromptById returns null for nonexisting ID", async () => {
        const prompt = await getPromptById("nonexistent-id");
        expect(prompt).toBeNull();
    });

    test("getPromptById returns prompt if found", async () => {
        const created = await createPrompt({
            projectId: defaultProjectId,
            name: "GetMe",
            content: "Get me content",
        });
        const found = await getPromptById(created.id);
        expect(found).not.toBeNull();
        expect(found?.name).toBe("GetMe");
    });

    test("listAllPrompts returns all", async () => {
        // start empty
        let all = await listAllPrompts();
        expect(all.length).toBe(0);

        await createPrompt({ projectId: defaultProjectId, name: "P1", content: "C1" });
        await createPrompt({ projectId: defaultProjectId, name: "P2", content: "C2" });
        all = await listAllPrompts();
        expect(all.length).toBe(2);
    });

    test("listPromptsByProject returns only prompts linked to that project", async () => {
        // Create two prompts
        const p1 = await createPrompt({ projectId: defaultProjectId, name: "P1", content: "C1" });
        const p2 = await createPrompt({ projectId: defaultProjectId, name: "P2", content: "C2" });

        // Create two projects
        const [projA] = await db.insert(schema.projects).values({ name: "ProjA", path: "/pA" }).returning();
        const [projB] = await db.insert(schema.projects).values({ name: "ProjB", path: "/pB" }).returning();

        // Link p1 -> projA, p2 -> projB
        await addPromptToProject(p1.id, projA.id);
        await addPromptToProject(p2.id, projB.id);

        const fromA = await listPromptsByProject(projA.id);
        expect(fromA.length).toBe(1);
        expect(fromA[0].id).toBe(p1.id);

        const fromB = await listPromptsByProject(projB.id);
        expect(fromB.length).toBe(1);
        expect(fromB[0].id).toBe(p2.id);
    });

    test("updatePrompt updates fields and returns updated prompt", async () => {
        const created = await createPrompt({ projectId: defaultProjectId, name: "Before", content: "Old" });
        const toUpdate: UpdatePromptBody = { name: "After", content: "New content" };
        const updated = await updatePrompt(created.id, toUpdate);

        expect(updated).not.toBeNull();
        expect(updated?.name).toBe("After");
        expect(updated?.content).toBe("New content");
    });

    test("updatePrompt returns null if prompt does not exist", async () => {
        const nonexistent = await updatePrompt("fake-id", { name: "X" });
        expect(nonexistent).toBeNull();
    });

    test("deletePrompt returns true if deleted, false if nonexistent", async () => {
        const prompt = await createPrompt({ projectId: defaultProjectId, name: "DelMe", content: "ToDelete" });
        const success = await deletePrompt(prompt.id);
        expect(success).toBe(true);

        const again = await deletePrompt(prompt.id);
        expect(again).toBe(false);
    });
});