import { builtinRules } from "eslint/use-at-your-own-risk";
import local from "./lint/plugin.js";
import stylistic from "@stylistic/eslint-plugin";


/******************************************************************************/
/* GLOBALS                                                                    */
/******************************************************************************/

function readonly(names)
{
    return Object.fromEntries(names.map((name) => [name, "readonly"]));
}

const SHARED_GLOBALS = [
    "AbortController", "AbortSignal", "Blob", "BroadcastChannel", "CustomEvent", "DOMException", "Event",
    "EventTarget", "File", "FormData", "Headers", "MessageChannel", "MessageEvent", "MessagePort",
    "ReadableStream", "Request", "Response", "TextDecoder", "TextEncoder", "TransformStream", "URL",
    "URLSearchParams", "WebAssembly", "WebSocket", "WritableStream", "atob", "btoa", "clearInterval",
    "clearTimeout", "console", "crypto", "fetch", "navigator", "performance", "queueMicrotask", "setInterval",
    "setTimeout", "structuredClone",
];

const BROWSER_GLOBALS = readonly([
    ...SHARED_GLOBALS,
    "Audio", "AudioContext", "CSS", "CanvasRenderingContext2D", "DOMParser", "DOMRect", "Document",
    "DocumentFragment", "Element", "FileReader", "FocusEvent", "FontFace", "GainNode", "Gamepad", "GamepadEvent",
    "HTMLAnchorElement", "HTMLButtonElement", "HTMLCanvasElement", "HTMLDivElement", "HTMLElement",
    "HTMLImageElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTemplateElement", "HTMLTextAreaElement",
    "Image", "ImageBitmap", "ImageData", "IntersectionObserver", "KeyboardEvent", "MouseEvent",
    "MutationObserver", "Node", "OffscreenCanvas", "Path2D", "PointerEvent", "ProgressEvent", "ResizeObserver",
    "SVGElement", "TouchEvent", "WebGL2RenderingContext", "WebGLRenderingContext", "WheelEvent", "Window",
    "Worker", "alert", "caches", "cancelAnimationFrame", "cancelIdleCallback", "confirm", "createImageBitmap",
    "customElements", "devicePixelRatio", "document", "getComputedStyle", "history", "indexedDB",
    "innerHeight", "innerWidth", "localStorage", "location", "matchMedia", "prompt", "requestAnimationFrame",
    "requestIdleCallback", "screen", "self", "sessionStorage", "window",
]);

const NODE_GLOBALS = readonly([
    ...SHARED_GLOBALS,
    "Buffer", "CompressionStream", "DecompressionStream", "Navigator", "Performance", "clearImmediate", "global",
    "process", "setImmediate",
]);


/******************************************************************************/
/* RULES                                                                      */
/******************************************************************************/

// The recommended config of @eslint/js: the core rules whose metadata marks them recommended.
const RECOMMENDED = Object.fromEntries(
    [...builtinRules]
        .filter(([, rule]) => rule.meta.docs?.recommended)
        .map(([name]) => [name, "error"]),
);

export default [
    { ignores: ["node_modules/", "libs/", "local/"] },
    {
        files: ["**/*.js"],
        plugins: { "@stylistic": stylistic, local },
        rules: {
            ...RECOMMENDED,
            "preserve-caught-error": "off",
            "no-console": "error",
            "no-underscore-dangle": ["error",
            {
                enforceInMethodNames: true,
                enforceInClassFields: true,
                allowFunctionParams: false,
                allowInArrayDestructuring: false,
                allowInObjectDestructuring: false,
            }],
            "sort-imports": "error",
            "@stylistic/brace-style": ["error", "allman", { allowSingleLine: true }],
            "@stylistic/keyword-spacing": ["error",
            {
                overrides:
                {
                    if: { after: false },
                    for: { after: false },
                    while: { after: false },
                    switch: { after: false },
                },
            }],
            "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/comma-dangle": ["error", "always-multiline"],
            "local/banner-width": "error",
        },
    },
    {
        files: ["js/**/*.js"],
        languageOptions: { globals: BROWSER_GLOBALS },
    },
    {
        files: ["tools/**/*.js", "lint/**/*.js", "js-tests/**/*.js", "eslint.config.js"],
        languageOptions: { globals: NODE_GLOBALS },
    },
    {
        files: ["js-tests/browser/**/*.js"],
        languageOptions: { globals: { ...NODE_GLOBALS, ...BROWSER_GLOBALS } },
    },
    {
        files: ["js/log.js"],
        rules: { "no-console": "off" },
    },
];
