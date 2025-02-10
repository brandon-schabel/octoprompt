import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { db, resetDatabase } from "@db";
import {
    createTicket,
    getTicketById,
    listTicketsByProject,
    updateTicket,
    deleteTicket,
    linkFilesToTicket,
    getTicketFiles,
    fetchTaskSuggestionsForTicket,
    suggestTasksForTicket,
    getTicketsWithFiles,
    createTask,
    getTasks,
    updateTask,
    deleteTask,
    reorderTasks,
    autoGenerateTasksFromOverview,
    listTicketsWithTaskCount,
    getTasksForTickets,
    listTicketsWithTasks,
    getTicketWithSuggestedFiles
} from "@/services/ticket-service";

describe("Ticket Service", () => {
    let fetchMock: ReturnType<typeof mock>;
    let summaryMock: ReturnType<typeof mock>;

    beforeEach(async () => {
        await resetDatabase();
        fetchMock = mock(async () => {
            return { tasks: [{ title: "MockTask", description: "MockDesc" }] };
        });
        summaryMock = mock(async () => "Fake project summary content");

        spyOn(
            await import("@/utils/structured-output-fetcher"),
            "fetchStructuredOutput"
        ).mockImplementation(fetchMock);

        spyOn(
            await import("@/utils/get-full-project-summary"),
            "getFullProjectSummary"
        ).mockImplementation(summaryMock);
    });

    test("createTicket inserts new row", async () => {
        const newT = await createTicket({
            projectId: "proj1",
            title: "TestTicket",
            overview: "Test overview",
            status: "open",
            priority: "normal",
        });
        expect(newT.id).toBeDefined();

        const found = db
            .query("SELECT * FROM tickets WHERE id = ?")
            .get(newT.id) as { title: string } | undefined;
        expect(found?.title).toBe("TestTicket");
    });

    test("getTicketById returns null if not found", async () => {
        const t = await getTicketById("nonexistent");
        expect(t).toBeNull();
    });

    test("listTicketsByProject returns only those tickets", async () => {
        // Insert two projects
        db.run(`INSERT INTO projects (name, path) VALUES (?, ?)`, ["PA", "/pA"]);
        const pA = ((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id).toString();

        db.run(`INSERT INTO projects (name, path) VALUES (?, ?)`, ["PB", "/pB"]);
        const pB = ((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id).toString();

        // Insert tickets
        await createTicket({ projectId: pA, title: "TicketA1", overview: "Overview A1", status: "open", priority: "normal" });
        await createTicket({ projectId: pA, title: "TicketA2", overview: "Overview A2", status: "open", priority: "normal" });
        await createTicket({ projectId: pB, title: "TicketB1", overview: "Overview B1", status: "open", priority: "normal" });

        const forA = await listTicketsByProject(pA);
        expect(forA.length).toBe(2);

        const forB = await listTicketsByProject(pB);
        expect(forB.length).toBe(1);
    });

    test("updateTicket modifies fields or returns null if not found", async () => {
        const ticket = await createTicket({
            projectId: "testproj",
            title: "Old",
            overview: "Old overview",
            status: "open",
            priority: "normal",
        });
        // Insert file to reference in suggestedFileIds
        db.run(
            `INSERT INTO files (id, project_id, name, path, extension, size)
            VALUES (?, ?, ?, ?, ?, ?)`,
            ["test-file-1", "testproj", "somefile", "somefile.txt", ".txt", 100]
        );
        const fId = "test-file-1";

        const updated = await updateTicket(ticket.id, {
            title: "NewTitle",
            suggestedFileIds: [fId],
        });
        expect(updated).not.toBeNull();
        expect(updated?.title).toBe("NewTitle");

        const no = await updateTicket("fakeid", { title: "No" });
        expect(no).toBeNull();
    });

    test("updateTicket throws if suggestedFileIds references missing file", async () => {
        const ticket = await createTicket({
            projectId: "testProj",
            title: "T",
            overview: "Test overview",
            status: "open",
            priority: "normal",
        });
        await expect(
            updateTicket(ticket.id, { suggestedFileIds: ["nonexistent-file"] })
        ).rejects.toThrow("Some fileIds no longer exist on disk");
    });

    test("deleteTicket returns true if deleted, false if not found", async () => {
        const ticket = await createTicket({
            projectId: "p1",
            title: "DelMe",
            overview: "Delete me overview",
            status: "open",
            priority: "normal",
        });
        const success = await deleteTicket(ticket.id);
        expect(success).toBe(true);

        const again = await deleteTicket(ticket.id);
        expect(again).toBe(false);
    });

    test("linkFilesToTicket inserts rows in ticketFiles, getTicketFiles retrieves them", async () => {
        const ticket = await createTicket({
            projectId: "pLink",
            title: "LinkT",
            overview: "Link ticket overview",
            status: "open",
            priority: "normal",
        });
        // Insert some files
        db.run(
            `INSERT INTO files (project_id, name, path, extension, size) VALUES (?, ?, ?, ?, ?);`,
            ["pLink", "f1", "f1.txt", ".txt", 111]
        );
        const f1 = ((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id).toString();

        db.run(
            `INSERT INTO files (project_id, name, path, extension, size) VALUES (?, ?, ?, ?, ?);`,
            ["pLink", "f2", "f2.txt", ".txt", 222]
        );
        const f2 = ((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id).toString();

        const linked = await linkFilesToTicket(ticket.id, [f1, f2]);
        expect(linked.length).toBe(2);

        const files = await getTicketFiles(ticket.id);
        expect(files.length).toBe(2);
    });

    test("linkFilesToTicket throws if ticket not found", async () => {
        await expect(linkFilesToTicket("fakeid", ["someFile"])).rejects.toThrow(
            "Ticket fakeid not found"
        );
    });

    test("fetchTaskSuggestionsForTicket uses fetchStructuredOutput, getFullProjectSummary", async () => {
        const ticket = await createTicket({
            projectId: "fetchTest",
            title: "TestTitle",
            overview: "Test overview",
            status: "open",
            priority: "normal",
        });

        const suggestions = await fetchTaskSuggestionsForTicket(ticket, "User context");
        expect(fetchMock.mock.calls.length).toBe(1);
        expect(summaryMock.mock.calls.length).toBe(1);
        expect(suggestions.tasks[0].title).toBe("MockTask");
    });

    test("suggestTasksForTicket calls fetchTaskSuggestionsForTicket, returns array of titles", async () => {
        const ticket = await createTicket({
            projectId: "pSugg",
            title: "SuggTitle",
            overview: "Suggest title overview",
            status: "open",
            priority: "normal",
        });
        const titles = await suggestTasksForTicket(ticket.id, "some context");
        expect(titles.length).toBe(1);
        expect(titles[0]).toBe("MockTask");
    });

    test("suggestTasksForTicket returns [] if error is thrown", async () => {
        fetchMock.mockImplementationOnce(async () => {
            throw new Error("AI error");
        });
        const ticket = await createTicket({
            projectId: "pErr",
            title: "ErrTicket",
            overview: "Error ticket overview",
            status: "open",
            priority: "normal",
        });
        const titles = await suggestTasksForTicket(ticket.id, "err context");
        expect(titles).toEqual([]);
    });

    test("suggestTasksForTicket throws if ticket not found", async () => {
        await expect(suggestTasksForTicket("fake", "ctx")).rejects.toThrow(
            "Ticket fake not found"
        );
    });

    test("getTicketsWithFiles merges file IDs", async () => {
        // Insert a project
        db.run(`INSERT INTO projects (name, path) VALUES (?, ?)`, ["WF", "/WF"]);
        const projId = ((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id).toString();

        // Two tickets
        const t1 = await createTicket({
            projectId: projId,
            title: "T1",
            overview: "T1 overview",
            status: "open",
            priority: "normal",
        });
        const t2 = await createTicket({
            projectId: projId,
            title: "T2",
            overview: "T2 overview",
            status: "open",
            priority: "normal",
        });

        // Insert two files
        db.run(
            `INSERT INTO files (project_id, name, path, extension, size) VALUES (?, ?, ?, ?, ?)`,
            [projId, "f1", "f1.txt", ".txt", 111]
        );
        const f1 = ((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id).toString();

        db.run(
            `INSERT INTO files (project_id, name, path, extension, size) VALUES (?, ?, ?, ?, ?)`,
            [projId, "f2", "f2.txt", ".txt", 222]
        );
        const f2 = ((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id).toString();

        await linkFilesToTicket(t1.id, [f1, f2]);
        await linkFilesToTicket(t2.id, [f2]);

        const all = await getTicketsWithFiles(projId);
        expect(all.length).toBe(2);

        const t1Info = all.find(x => x.id === t1.id);
        expect(t1Info?.fileIds.length).toBe(2);

        const t2Info = all.find(x => x.id === t2.id);
        expect(t2Info?.fileIds.length).toBe(1);
    });

    test("createTask inserts new row with incremented orderIndex", async () => {
        const t = await createTicket({
            projectId: "tt",
            title: "T",
            overview: "Ticket overview",
            status: "open",
            priority: "normal",
        });
        const task1 = await createTask(t.id, "First");
        expect(task1.id).toBeDefined();
        expect(task1.orderIndex).toBe(1);

        const task2 = await createTask(t.id, "Second");
        expect(task2.orderIndex).toBe(2);
    });

    test("createTask throws if ticket not found", async () => {
        await expect(createTask("fakeid", "Nope")).rejects.toThrow("NOT_FOUND");
    });

    test("getTasks returns tasks sorted by orderIndex", async () => {
        const t = await createTicket({
            projectId: "tt2",
            title: "T2",
            overview: "T2 overview",
            status: "open",
            priority: "normal",
        });
        const taskA = await createTask(t.id, "A");
        const taskB = await createTask(t.id, "B");
        const tasks = await getTasks(t.id);
        expect(tasks.length).toBe(2);
        expect(tasks[0].id).toBe(taskA.id);
        expect(tasks[1].id).toBe(taskB.id);
    });

    test("updateTask modifies content/done, returns null if not found", async () => {
        const t = await createTicket({
            projectId: "tt3",
            title: "T3",
            overview: "T3 overview",
            status: "open",
            priority: "normal",
        });
        const task = await createTask(t.id, "OldContent");

        await updateTask(t.id, task.id, { content: "NewContent", done: true });
        const all = await getTasks(t.id);
        expect(all[0].content).toBe("NewContent");
        expect(all[0].done).toBe(true);

        const notFound = await updateTask(t.id, "fakeTaskId", { done: false });
        expect(notFound).toBeNull();
    });

    test("deleteTask returns true if removed, false if not found", async () => {
        const t = await createTicket({
            projectId: "delT",
            title: "Del",
            overview: "Delete ticket overview",
            status: "open",
            priority: "normal",
        });
        const task = await createTask(t.id, "ToDel");
        const success = await deleteTask(t.id, task.id);
        expect(success).toBe(true);

        const again = await deleteTask(t.id, task.id);
        expect(again).toBe(false);
    });

    test("reorderTasks updates multiple orderIndexes", async () => {
        const t = await createTicket({
            projectId: "rt",
            title: "RT",
            overview: "Reorder ticket overview",
            status: "open",
            priority: "normal",
        });
        const ta = await createTask(t.id, "A");
        const tb = await createTask(t.id, "B");

        await reorderTasks(t.id, [
            { taskId: ta.id, orderIndex: 2 },
            { taskId: tb.id, orderIndex: 1 },
        ]);

        const tasks = await getTasks(t.id);
        expect(tasks[0].id).toBe(tb.id);
        expect(tasks[0].orderIndex).toBe(1);
        expect(tasks[1].id).toBe(ta.id);
        expect(tasks[1].orderIndex).toBe(2);
    });

    test("autoGenerateTasksFromOverview calls suggestTasksForTicket, inserts tasks", async () => {
        const t = await createTicket({
            projectId: "auto",
            title: "Auto",
            overview: "Auto generate overview",
            status: "open",
            priority: "normal",
        });
        const newTasks = await autoGenerateTasksFromOverview(t.id);
        expect(newTasks.length).toBe(1);
        expect(newTasks[0].content).toBe("MockTask");
    });

    test("listTicketsWithTaskCount returns array with aggregated taskCount", async () => {
        db.run(`INSERT INTO projects (name, path) VALUES (?, ?)`, ["TaskCountProj", "/tcp"]);
        const projId = ((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id).toString();

        const tk1 = await createTicket({ projectId: projId, title: "TC1", overview: "TC1 overview", status: "open", priority: "normal" });
        const tk2 = await createTicket({ projectId: projId, title: "TC2", overview: "TC2 overview", status: "open", priority: "normal" });

        // tk1 -> 2 tasks, tk2 -> 1 task
        await createTask(tk1.id, "T1A");
        await createTask(tk1.id, "T1B");
        await createTask(tk2.id, "T2A");

        const results = await listTicketsWithTaskCount(projId);
        expect(results.length).toBe(2);

        const r1 = results.find(r => r.id === tk1.id);
        expect(r1?.taskCount).toBe(2);

        const r2 = results.find(r => r.id === tk2.id);
        expect(r2?.taskCount).toBe(1);
    });

    test("getTasksForTickets returns object keyed by ticketId", async () => {
        const t1 = await createTicket({
            projectId: "gT",
            title: "T1",
            overview: "T1 overview",
            status: "open",
            priority: "normal",
        });
        const t2 = await createTicket({
            projectId: "gT",
            title: "T2",
            overview: "T2 overview",
            status: "open",
            priority: "normal",
        });
        await createTask(t1.id, "One");
        await createTask(t1.id, "Two");
        await createTask(t2.id, "Other");

        const map = await getTasksForTickets([t1.id, t2.id]);
        expect(Object.keys(map).length).toBe(2);
        expect(map[t1.id].length).toBe(2);
        expect(map[t2.id].length).toBe(1);
    });

    test("listTicketsWithTasks merges tasks array", async () => {
        const t1 = await createTicket({
            projectId: "lT",
            title: "TT1",
            overview: "TT1 overview",
            status: "open",
            priority: "normal",
        });
        const t2 = await createTicket({
            projectId: "lT",
            title: "TT2",
            overview: "TT2 overview",
            status: "open",
            priority: "normal",
        });
        await createTask(t1.id, "TaskA");
        await createTask(t1.id, "TaskB");

        const found = await listTicketsWithTasks("lT");
        expect(found.length).toBe(2);
        const f1 = found.find(x => x.id === t1.id);
        expect(f1?.tasks.length).toBe(2);

        const f2 = found.find(x => x.id === t2.id);
        expect(f2?.tasks.length).toBe(0);
    });
    
    test("getTicketWithSuggestedFiles returns parsed array of file IDs", async () => {
        const t = await createTicket({
            projectId: "gsf",
            title: "SF",
            overview: "SF overview",
            status: "open",
            priority: "normal",
        });

        // Insert files with id="abc" and id="def"
        db.run(
            `INSERT INTO files (id, project_id, name, path, extension, size)
           VALUES (?, ?, ?, ?, ?, ?)`,
            ["abc", "gsf", "FileABC", "abc.txt", ".txt", 123]
        );
        db.run(
            `INSERT INTO files (id, project_id, name, path, extension, size)
           VALUES (?, ?, ?, ?, ?, ?)`,
            ["def", "gsf", "FileDEF", "def.txt", ".txt", 456]
        );

        // Now this won't throw the 'FILE_NOT_FOUND' error
        await updateTicket(t.id, { suggestedFileIds: ["abc", "def"] });

        const withFiles = await getTicketWithSuggestedFiles(t.id);
        expect(withFiles?.parsedSuggestedFileIds).toEqual(["abc", "def"]);
    });
});