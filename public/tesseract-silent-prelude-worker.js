/* eslint-disable no-console */
/**
 * Обёртка для tesseract.js worker: глушит шум WASM (stderr → console) до загрузки worker.min.js.
 * Путь: /tesseract-silent-prelude-worker.js (public/)
 */
(function patchConsoleForTesseractWasm() {
  try {
    const isNoise = (blob) =>
      /Image too small to scale/i.test(blob) ||
      /Line cannot be recognized/i.test(blob) ||
      /Estimating resolution as/i.test(blob);

    const toBlob = (args) =>
      Array.from(args)
        .map((a) => {
          if (typeof a === "string") return a;
          if (a instanceof Error) return `${a.message}\n${a.stack || ""}`;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join("\n");

    const origErr = console.error.bind(console);
    console.error = function tesseractSilentError() {
      if (isNoise(toBlob(arguments))) return;
      return origErr.apply(console, arguments);
    };

    const origWarn = console.warn.bind(console);
    console.warn = function tesseractSilentWarn() {
      const first = String(arguments[0] || "");
      if (isNoise(toBlob(arguments)) || first.includes("Parameter not found:")) return;
      return origWarn.apply(console, arguments);
    };
  } catch {
    /* ignore */
  }
})();

importScripts("https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js");
