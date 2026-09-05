/* 🖥️ Retro-Mac mermaid bootstrap.
 * mkdocs-material auto-loads mermaid.js when it detects mermaid fences.
 * This script is defensive: any failure is swallowed so it can never
 * break page rendering. It waits for mermaid to exist, then re-renders
 * diagrams with a grayscale "classic Mac" theme. */
(function () {
  "use strict";

  function grayscaleTheme() {
    return {
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        background: "#ffffff",
        primaryColor: "#dddddd",
        primaryTextColor: "#000000",
        primaryBorderColor: "#000000",
        lineColor: "#000000",
        secondaryColor: "#eeeeee",
        tertiaryColor: "#ffffff",
        fontFamily: "Verdana, Geneva, sans-serif",
        fontSize: "14px"
      },
      flowchart: { htmlLabels: true, curve: "linear" }
    };
  }

  function applyTheme() {
    try {
      if (typeof window.mermaid === "undefined") return false;
      window.mermaid.initialize(grayscaleTheme());
      return true;
    } catch (err) {
      /* Never let a theme tweak break the page. */
      if (window.console && console.warn) {
        console.warn("retro-mac mermaid init skipped:", err);
      }
      return true; /* stop retrying — mermaid default theme is fine */
    }
  }

  var attempts = 0;
  var timer = setInterval(function () {
    attempts += 1;
    if (applyTheme() || attempts > 40) {
      clearInterval(timer);
    }
  }, 250);
})();
