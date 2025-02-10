import { describe, test, expect, beforeEach } from "bun:test";
import {
  createPrompt, addPromptToProject, removePromptFromProject,
  getPromptById, listAllPrompts, listPromptsByProject,
  updatePrompt, deletePrompt
} from "@/services/prompt-service";
import { randomString } from "./test-utils";
import { db, resetDatabase } from "@db";

describe("Prompt Service", () => {
  let defaultProjectId: string;

  beforeEach(async () => {
    // Re-initialize or reset DB
    await resetDatabase();

    // Insert a default project
    db.run(
      `INSERT INTO projects (name, path) VALUES (?, ?)`,
      [`TestProject_${randomString()}`, `/test/path_${randomString()}`]
    );
    defaultProjectId = db.query("SELECT last_insert_rowid() as id").get().id;
  });

  test("createPrompt inserts a new prompt", async () => {
    const input = {
      projectId: defaultProjectId,
      name: `TestPrompt_${randomString()}`,
      content: "Some prompt content",
    };
    const created = await createPrompt(input);
    expect(created.id).toBeDefined();
    expect(created.name).toBe(input.name);

    // Check DB
    const row = db
      .query("SELECT * FROM prompts WHERE id = ?")
      .get(created.id);
    expect(row).not.toBeUndefined();
    expect(row.content).toBe("Some prompt content");
  });

  test("addPromptToProject then removePromptFromProject associates/unassociates prompt", async () => {
    const prompt = await createPrompt({
      projectId: defaultProjectId,
      name: "AssocTest",
      content: "Associated test content"
    });

    // Insert a separate project
    db.run(`INSERT INTO projects (name, path) VALUES (?, ?)`,
      ["ProjForPrompt", "/fake/path"]
    );
    const projectId = db.query("SELECT last_insert_rowid() as id").get().id;

    // Associate
    await addPromptToProject(prompt.id, projectId);

    const rows = db
      .query("SELECT * FROM prompt_projects WHERE prompt_id = ?")
      .all(prompt.id);
    expect(rows.length).toBe(1);
    expect(Number(rows[0].project_id)).toBe(projectId);

    // Remove association
    await removePromptFromProject(prompt.id, projectId);
    const afterRemoval = db
      .query("SELECT * FROM prompt_projects WHERE prompt_id = ?")
      .all(prompt.id);
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
    let all = await listAllPrompts();
    expect(all.length).toBe(0);

    await createPrompt({ projectId: defaultProjectId, name: "P1", content: "C1" });
    await createPrompt({ projectId: defaultProjectId, name: "P2", content: "C2" });
    all = await listAllPrompts();
    expect(all.length).toBe(2);
  });

  test("listPromptsByProject returns only prompts linked to that project", async () => {
    const p1 = await createPrompt({ projectId: defaultProjectId, name: "P1", content: "C1" });
    const p2 = await createPrompt({ projectId: defaultProjectId, name: "P2", content: "C2" });

    // Two projects
    db.run(`INSERT INTO projects (name, path) VALUES (?, ?)`, ["ProjA", "/pA"]);
    const projA = db.query("SELECT last_insert_rowid() as id").get().id;

    db.run(`INSERT INTO projects (name, path) VALUES (?, ?)`, ["ProjB", "/pB"]);
    const projB = db.query("SELECT last_insert_rowid() as id").get().id;

    await addPromptToProject(p1.id, projA);
    await addPromptToProject(p2.id, projB);

    const fromA = await listPromptsByProject(projA);
    expect(fromA.length).toBe(1);
    expect(fromA[0].id).toBe(p1.id);

    const fromB = await listPromptsByProject(projB);
    expect(fromB.length).toBe(1);
    expect(fromB[0].id).toBe(p2.id);
  });

  test("updatePrompt updates fields and returns updated prompt", async () => {
    const created = await createPrompt({
      projectId: defaultProjectId,
      name: "Before",
      content: "Old",
    });
    const updated = await updatePrompt(created.id, { name: "After", content: "New content" });
    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("After");
    expect(updated?.content).toBe("New content");
  });

  test("updatePrompt returns null if prompt does not exist", async () => {
    const nonexistent = await updatePrompt("fake-id", { name: "X" });
    expect(nonexistent).toBeNull();
  });

  test("deletePrompt returns true if deleted, false if nonexistent", async () => {
    const prompt = await createPrompt({
      projectId: defaultProjectId,
      name: "DelMe",
      content: "ToDelete"
    });
    const success = await deletePrompt(prompt.id);
    expect(success).toBe(true);

    const again = await deletePrompt(prompt.id);
    expect(again).toBe(false);
  });
});