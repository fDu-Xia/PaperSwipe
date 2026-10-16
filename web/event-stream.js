// Decode the server's LF-delimited JSON events without owning UI or requests.
(function (root) {
  async function consumeSSE(stream, dispatch) {
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (!rawEvent.trim()) continue;
          let name = "message";
          const dataLines = [];
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("event:")) name = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^\s/, ""));
          }
          if (!dataLines.length) continue;
          let payload;
          try {
            payload = JSON.parse(dataLines.join("\n"));
          } catch (err) {
            console.warn("[sse] bad JSON payload for", name, err);
            continue;
          }
          dispatch(name, payload);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  root.PaperSwipeStream = Object.freeze({consumeSSE});
})(globalThis);
