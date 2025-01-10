/**
 * createMockSSEStream simulates a streaming SSE response by emitting lines one at a time.
 *
 * @param chunks Each array entry will be returned as an SSE data line: `data: <entry>\n\n`.
 * @param options.endWithDone If true, appends a `data: [DONE]\n\n` at the end. Default: true.
 * @param options.delayMs     Milliseconds to wait between emitting each chunk. Default: 100.
 */
export function createMockSSEStream(
    chunks: string[],
    options: { endWithDone?: boolean; delayMs?: number } = {}
  ): ReadableStream<Uint8Array> {
    const { endWithDone = true, delayMs = 100 } = options;
  
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
  
    // Emit lines one by one, optionally appending a DONE signal
    (async () => {
      try {
        for (const chunk of chunks) {
          // SSE line format: data: <chunk>\n\n
          const dataLine = `data: ${chunk}\n\n`;
          await writer.write(encoder.encode(dataLine));
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
  
        // Optionally append the SSE "[DONE]" line
        if (endWithDone) {
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        }
  
        writer.close();
      } catch (error) {
        writer.abort(error);
      }
    })();
  
    return readable;
  }