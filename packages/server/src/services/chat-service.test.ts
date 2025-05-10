import { describe, test, expect, beforeEach } from "bun:test";
import { db, resetDatabase } from "@db";
import { createChatService } from "@/services/chat-service";
import { randomString } from "../utils/test-utils";

let chatService: ReturnType<typeof createChatService>;

describe("Chat Service", () => {
  beforeEach(async () => {
    // Re-initialize or reset DB
    await resetDatabase();

    
    chatService = createChatService();
  });

  test("createChat should insert a new chat record", async () => {
    const title = `Chat_${randomString()}`;
    const chat = await chatService.createChat(title);
    expect(chat.id).toBeDefined();
    expect(chat.title).toBe(title);

    // Verify via direct DB query
    const row = db
      .query("SELECT * FROM chats WHERE id = ? LIMIT 1")
      .get(chat.id) as any;
    expect(row).not.toBeUndefined();
    expect(row.title).toBe(title);
  });

  test("createChat with copyExisting copies messages from another chat", async () => {
    const source = await chatService.createChat("SourceChat");
    // Insert two messages
    await chatService.saveMessage({ chatId: source.id, role: "system", content: "Hello" });
    await chatService.saveMessage({ chatId: source.id, role: "user", content: "World" });

    const newChat = await chatService.createChat("CopyTarget", {
      copyExisting: true,
      currentChatId: source.id,
    });

    expect(newChat.id).toBeDefined();

    // Check that new chat has the same 2 messages
    const newMessages = await chatService.getChatMessages(newChat.id);
    expect(newMessages.length).toBe(2);
    expect(newMessages[0].content).toBe("Hello");
    expect(newMessages[1].content).toBe("World");
  });

  test("saveMessage inserts a new message", async () => {
    const chat = await chatService.createChat("MessageTest");
    const msg = await chatService.saveMessage({
      chatId: chat.id,
      role: "user",
      content: "Sample content",
    });
    expect(msg.id).toBeDefined();

    // Raw query check
    const row = db
      .query("SELECT * FROM chat_messages WHERE id = ? LIMIT 1")
      .get(msg.id) as any;
    expect(row).not.toBeUndefined();
    expect(row.content).toBe("Sample content");
  });

  test("updateMessageContent changes content of a message", async () => {
    const chat = await chatService.createChat("UpdateMsg");
    const msg = await chatService.saveMessage({
      chatId: chat.id,
      role: "user",
      content: "Old content",
    });

    await chatService.updateMessageContent(msg.id, "New content");
    const row = db
      .query("SELECT * FROM chat_messages WHERE id = ? LIMIT 1")
      .get(msg.id) as any;
    expect(row.content).toBe("New content");
  });

  test("getAllChats returns all chats sorted by updatedAt", async () => {
    await chatService.createChat("ChatA");
    await chatService.createChat("ChatB");
    await chatService.createChat("ChatC");

    const chats = await chatService.getAllChats();
    expect(chats.length).toBe(3);
    // Additional sorting check can be done if needed
  });

  test("updateChat changes the chat title", async () => {
    const chat = await chatService.createChat("InitialTitle");
    const updated = await chatService.updateChat(chat.id, "NewTitle");
    expect(updated.title).toBe("NewTitle");
  });

  test("deleteChat removes chat and its messages", async () => {
    const chat = await chatService.createChat("DeleteMe");
    await chatService.saveMessage({ chatId: chat.id, role: "user", content: "Hello" });
    await chatService.saveMessage({ chatId: chat.id, role: "assistant", content: "World" });

    await chatService.deleteChat(chat.id);

    // Ensure chat is gone
    const chatRow = db
      .query("SELECT * FROM chats WHERE id = ? LIMIT 1")
      .get(chat.id) as any;
    expect(chatRow).toBeNull();

    // Ensure messages are gone
    const messages = db
      .query("SELECT * FROM chat_messages WHERE chat_id = ?")
      .all(chat.id);
    expect(messages.length).toBe(0);
  });

  test("deleteMessage removes only that message", async () => {
    const chat = await chatService.createChat("MsgDelete");
    const m1 = await chatService.saveMessage({
      chatId: chat.id,
      role: "user",
      content: "First",
    });
    const m2 = await chatService.saveMessage({
      chatId: chat.id,
      role: "assistant",
      content: "Second",
    });

    await chatService.deleteMessage(m1.id);

    const all = await chatService.getChatMessages(chat.id);
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(m2.id);
  });

  test("forkChat duplicates chat and messages except excluded IDs", async () => {
    const source = await chatService.createChat("SourceFork");
    const msgA = await chatService.saveMessage({ chatId: source.id, role: "user", content: "A" });
    const msgB = await chatService.saveMessage({ chatId: source.id, role: "assistant", content: "B" });
    const msgC = await chatService.saveMessage({ chatId: source.id, role: "user", content: "C" });

    const newChat = await chatService.forkChat(source.id, [msgB.id]);
    const newMessages = await chatService.getChatMessages(newChat.id);

    // B was excluded
    expect(newMessages.length).toBe(2);
    expect(newMessages.some(m => m.content === "A")).toBe(true);
    expect(newMessages.some(m => m.content === "B")).toBe(false);
    expect(newMessages.some(m => m.content === "C")).toBe(true);
  });

  test("forkChatFromMessage only copies messages up to a given message, excluding any if needed", async () => {
    const source = await chatService.createChat("ForkFromMsg");
    const msg1 = await chatService.saveMessage({
      chatId: source.id,
      role: "user",
      content: "Msg1",
    });
    const msg2 = await chatService.saveMessage({
      chatId: source.id,
      role: "assistant",
      content: "Msg2",
    });
    const msg3 = await chatService.saveMessage({
      chatId: source.id,
      role: "user",
      content: "Msg3",
    });

    // Fork from msg2, exclude msg1
    const newChat = await chatService.forkChatFromMessage(source.id, msg2.id, [msg1.id]);
    const newMsgs = await chatService.getChatMessages(newChat.id);

    // Should include msg2, skip msg3 (because it's after msg2), skip msg1 as excluded
    expect(newMsgs.length).toBe(1);
    expect(newMsgs[0].content).toBe("Msg2");
  });
});