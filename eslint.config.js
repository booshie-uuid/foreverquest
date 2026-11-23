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
    "AbortController", "AbortSignal", "Blob", "BroadcastChannel", "CompressionStream", "CustomEvent",
    "DOMException", "DecompressionStream", "Event",
    "EventTarget", "File", "FormData", "Headers", "MessageChannel", "MessageEvent", "MessagePort",
    "ReadableStream", "Request", "Response", "TextDecoder", "TextEncoder", "TransformStream", "URL",
    "URLSearchParams", "WebAssembly", "WebSocket", "WritableStream", "atob", "btoa", "clearInterval",
    "clearTimeout", "console", "crypto", "fetch", "navigator", "performance", "queueMicrotask", "setInterval",
    "setTimeout", "structuredClone",
];

const PAGE_GLOBALS = [
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
];

const BROWSER_GLOBALS = readonly([...SHARED_GLOBALS, ...PAGE_GLOBALS]);

// Config objects merge their globals, so the page globals are switched off.
const SIMULATION_GLOBALS = { ...Object.fromEntries(PAGE_GLOBALS.map((name) => [name, "off"])), ...readonly(SHARED_GLOBALS) };

const NODE_GLOBALS = readonly([
    ...SHARED_GLOBALS,
    "Buffer", "Navigator", "Performance", "clearImmediate", "global",
    "process", "setImmediate",
]);


/******************************************************************************/
/* BOUNDARIES                                                                 */
/******************************************************************************/

const GAME_IMPORTS =
{
    regex: "(^|/)(content|tools)/",
    message: "Game code cannot import authoring code. Read the baked asset instead.",
};

const SIMULATION_IMPORTS =
{
    regex: "^three$|/(engine|render|ui)/",
    message: "The simulation runs without a renderer or a page.",
};

const WORKER_IMPORTS =
{
    regex: "^three$",
    message: "Worker code cannot import Three.js, because a worker does not see the page's import map.",
};

const UNSEEDED =
[
    { object: "Math", property: "random", message: "Use a seeded Random so every bake gives the same files." },
    { object: "Date", property: "now", message: "A bake cannot depend on the time." },
    { object: "performance", property: "now", message: "A bake cannot depend on the time." },
];


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
    { ignores: ["node_modules/", "libs/", "local/", "assets/"] },
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
        rules: { "no-restricted-imports": ["error", { patterns: [GAME_IMPORTS] }] },
    },
    {
        files: ["js/render/cube-mesher.js", "js/render/mesh-worker.js"],
        rules: { "no-restricted-imports": ["error", { patterns: [GAME_IMPORTS, WORKER_IMPORTS] }] },
    },
    {
        files: ["js/sim/**/*.js"],
        languageOptions: { globals: SIMULATION_GLOBALS },
        rules: { "no-restricted-imports": ["error", { patterns: [GAME_IMPORTS, SIMULATION_IMPORTS] }] },
    },
    {
        files: ["content/**/*.js"],
        languageOptions: { globals: readonly(SHARED_GLOBALS) },
    },
    {
        files: ["content/**/*.js", "tools/bake/**/*.js"],
        rules:
        {
            "no-restricted-properties": ["error", ...UNSEEDED],
            "no-restricted-syntax": ["error", { selector: "NewExpression[callee.name='Date']", message: "A bake cannot depend on the time." }],
        },
    },
    {
        files: ["tools/**/*.js", "lint/**/*.js", "js-tests/**/*.js", "eslint.config.js"],
        languageOptions: { globals: NODE_GLOBALS },
    },
    {
        files: ["tools/workbench/page/**/*.js"],
        languageOptions: { globals: BROWSER_GLOBALS },
        rules: { "no-restricted-imports": ["error", { patterns: [GAME_IMPORTS] }] },
    },
    {
        files: ["js-tests/browser/**/*.js", "tools/workbench/capture.js"],
        languageOptions: { globals: { ...NODE_GLOBALS, ...BROWSER_GLOBALS } },
    },
    {
        files: ["js/log.js"],
        rules: { "no-console": "off" },
    },
];
