/* Display-only cleanup of common LaTeX typography; leave equations and source records intact. */
(() => {
  function clean(value) {
    let text = String(value ?? '');
    // Innermost-first supports nested typography without stripping mathematical braces.
    const wrapper = /\\(?:textbf|textit|texttt|textsf|textrm|emph|mbox|underline)\s*\{([^{}]*)\}/g;
    for (let i = 0; i < 16; i++) {
      const next = text.replace(wrapper, '$1');
      if (next === text) break;
      text = next;
    }
    return text.replace(/\\([%&#_])/g, '$1');
  }
  window.PaperSwipeText = {clean};
})();
