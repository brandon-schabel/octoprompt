// File: packages/websocket-react-example/client/src/App.tsx
import { useContext, useState } from "react";
import { useWebSocketClient } from "@bnk/websocket-manager-react";
import { MessageLogContext } from "./chat-web-socket-provider";
import { OutgoingClientMessage } from "./websocket-chat-types";

function App() {
  // Grab our WebSocket context to send messages or manually disconnect if needed
  const { sendMessage, isOpen } = useWebSocketClient();

  // Grab the chat log from the ChatWebSocketProvider
  const { messageLog } = useContext(MessageLogContext);

  // Local input form state
  const [text, setText] = useState("");
  const [sender, setSender] = useState("Anonymous");

  /**
   * A helper to send a new chat message to the server
   */
  const sendChat = () => {
    if (!text.trim()) return;
    const msg: OutgoingClientMessage = {
      type: "chat",
      payload: {
        text: text.trim(),
        sender: sender.trim() || "Anonymous",
      }
    };
    sendMessage(msg);
    setText("");
  };

  return (
    <div style={styles.container}>
      <h1>WebSocket Chat Example</h1>
      <p>
        WebSocket Connection Status:{" "}
        <strong>{isOpen ? "OPEN" : "CLOSED"}</strong>
      </p>

      <div style={styles.chatSection}>
        <div style={styles.logContainer}>
          {messageLog?.map((line, idx) => (
            <div key={idx} style={styles.logLine}>
              {line}
            </div>
          ))}
        </div>
        <div style={styles.form}>
          <input
            placeholder="Your name"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
          />
          <input
            placeholder="Type message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendChat()}
          />
          <button onClick={sendChat}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;

/** Some inline styles for clarity */
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 600,
    margin: "0 auto",
    padding: 16,
    fontFamily: "sans-serif"
  },
  chatSection: {
    border: "1px solid #ccc",
    padding: 16,
    marginTop: 16
  },
  logContainer: {
    height: 200,
    overflowY: "auto",
    border: "1px solid #aaa",
    marginBottom: 8,
    padding: 8
  },
  logLine: {
    margin: "4px 0"
  },
  form: {
    display: "flex",
    gap: 8
  }
};