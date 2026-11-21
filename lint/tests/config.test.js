import { describe, it } from "node:test";
import { ESLint } from "eslint";
import assert from "node:assert/strict";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const STARS = "/******************************************************************************/";

function code(...lines)
{
    return lines.join("\n") + "\n";
}


/******************************************************************************/
/* BROKEN                                                                     */
/******************************************************************************/

const BROKEN = [
    {
        name: "an opening brace on the line of its function",
        rule: "@stylistic/brace-style",
        code: code(
            "export function check(value) {",
            "    return value;",
            "}",
        ),
    },
    {
        name: "else on the line of the closing brace",
        rule: "@stylistic/brace-style",
        code: code(
            "export function check(value)",
            "{",
            "    if(value)",
            "    {",
            "        return 1;",
            "    } else",
            "    {",
            "        return 0;",
            "    }",
            "}",
        ),
    },
    {
        name: "a space after if",
        rule: "@stylistic/keyword-spacing",
        code: code(
            "export function check(value)",
            "{",
            "    if (value) { return 1; }",
            "",
            "    return 0;",
            "}",
        ),
    },
    {
        name: "a space after for",
        rule: "@stylistic/keyword-spacing",
        code: code(
            "export function sum(values)",
            "{",
            "    let total = 0;",
            "    for (const value of values) { total += value; }",
            "",
            "    return total;",
            "}",
        ),
    },
    {
        name: "a space after while",
        rule: "@stylistic/keyword-spacing",
        code: code(
            "export function drain(queue)",
            "{",
            "    while (queue.length) { queue.pop(); }",
            "}",
        ),
    },
    {
        name: "a space after switch",
        rule: "@stylistic/keyword-spacing",
        code: code(
            "export function label(kind)",
            "{",
            "    switch (kind)",
            "    {",
            '        case "a": return 1;',
            "        default: return 0;",
            "    }",
            "}",
        ),
    },
    {
        name: "a space after for await",
        rule: "@stylistic/keyword-spacing",
        code: code(
            "export async function drain(stream, sink)",
            "{",
            "    for await (const chunk of stream) { sink.push(chunk); }",
            "}",
        ),
    },
    {
        name: "no space after return",
        rule: "@stylistic/keyword-spacing",
        code: code(
            "export function check(value)",
            "{",
            "    return(value);",
            "}",
        ),
    },
    {
        name: "single quotes",
        rule: "@stylistic/quotes",
        code: code("export const NAME = 'hero';"),
    },
    {
        name: "a missing semicolon",
        rule: "@stylistic/semi",
        code: code('export const NAME = "hero"'),
    },
    {
        name: "a multiline object without a trailing comma",
        rule: "@stylistic/comma-dangle",
        code: code(
            "export const POINT = {",
            "    x: 1,",
            "    y: 2",
            "};",
        ),
    },
    {
        name: "a variable with a _ prefix",
        rule: "no-underscore-dangle",
        code: code("export const _name = 1;"),
    },
    {
        name: "a variable with a _ suffix",
        rule: "no-underscore-dangle",
        code: code("export const name_ = 1;"),
    },
    {
        name: "a parameter with a _ prefix",
        rule: "no-underscore-dangle",
        code: code(
            "export function check(_value)",
            "{",
            "    return _value;",
            "}",
        ),
    },
    {
        name: "a method and a field with a _ prefix",
        rule: "no-underscore-dangle",
        code: code(
            "export class Store",
            "{",
            "    _count = 0;",
            "",
            "    _load()",
            "    {",
            "        return this.count;",
            "    }",
            "}",
        ),
    },
    {
        name: "a member read with a _ prefix",
        rule: "no-underscore-dangle",
        code: code(
            "export function count(store)",
            "{",
            "    return store._count;",
            "}",
        ),
    },
    {
        name: "imports out of order",
        rule: "sort-imports",
        code: code(
            'import { Meta } from "./meta.js";',
            'import { Log } from "./log.js";',
            "",
            "export { Log, Meta };",
        ),
    },
    {
        name: "import members out of order",
        rule: "sort-imports",
        code: code(
            'import { Meta, Log } from "./meta.js";',
            "",
            "export { Log, Meta };",
        ),
    },
    {
        name: "console in a game module",
        rule: "no-console",
        code: code('console.log("ready");'),
    },
    {
        name: "console in a tool",
        rule: "no-console",
        file: "tools/serve.js",
        code: code('console.log("ready");'),
    },
    {
        name: "a short star line",
        rule: "local/banner-width",
        code: code("/*****************************************************************************/"),
    },
    {
        name: "a long sub-section banner",
        rule: "local/banner-width",
        code: code("/* SUB-SECTION *****************************************************************/"),
    },
    {
        name: "a short section title line",
        rule: "local/banner-width",
        code: code(
            STARS,
            "/* SECTION                                                                   */",
            STARS,
        ),
    },
    {
        name: "a Node global in a game module",
        rule: "no-undef",
        code: code("export const ARGS = process.argv;"),
    },
    {
        name: "a browser global in a tool",
        rule: "no-undef",
        file: "tools/serve.js",
        code: code("export const BODY = document.body;"),
    },
    {
        name: "an unused variable",
        rule: "no-unused-vars",
        code: code("const unused = 1;"),
    },
];


/******************************************************************************/
/* ALLOWED                                                                    */
/******************************************************************************/

const ALLOWED = [
    {
        name: "an Allman class with fields, methods and aligned one-line methods",
        code: code(
            "export class Store",
            "{",
            '    static ROW_KEY = "store";',
            "    #pending = new Map();",
            "",
            "    constructor()",
            "    {",
            "        this.entries = new Map();",
            "        this.listeners = [];",
            "    }",
            "",
            "    list()       { return [...this.entries.values()]; }",
            "    count()      { return this.entries.size; }",
            "    get(key)     { return this.entries.get(key) ?? this.#pending.get(key) ?? null; }",
            "",
            "    onChange(listener)",
            "    {",
            "        this.listeners.push(listener);",
            "    }",
            "",
            "    emitChange()",
            "    {",
            "        for(const listener of this.listeners) { listener(this); }",
            "    }",
            "}",
        ),
    },
    {
        name: "Allman if, else if and else with a single-line guard",
        code: code(
            "export function grade(score)",
            "{",
            "    if(score === undefined) { return null; }",
            "",
            "    if(score > 90)",
            "    {",
            '        return "A";',
            "    }",
            "    else if(score > 50)",
            "    {",
            '        return "B";',
            "    }",
            "    else",
            "    {",
            '        return "C";',
            "    }",
            "}",
        ),
    },
    {
        name: "Allman try and catch that logs and rethrows",
        code: code(
            'import * as UserApi from "./user-api.js";',
            'import { Log } from "./log.js";',
            "",
            "export async function loadUser(userId)",
            "{",
            "    try",
            "    {",
            "        return await UserApi.read(userId);",
            "    }",
            "    catch(error)",
            "    {",
            '        Log.error("Could not load the user", error);',
            "",
            '        throw new Error("The user could not be loaded. Try again later.");',
            "    }",
            "}",
        ),
    },
    {
        name: "while, do-while and switch without a space",
        code: code(
            "export function drain(queue, kind)",
            "{",
            "    while(queue.length > 1) { queue.pop(); }",
            "",
            "    do",
            "    {",
            "        queue.pop();",
            "    }",
            "    while(queue.length);",
            "",
            "    switch(kind)",
            "    {",
            '        case "a": return 1;',
            "        default: return 0;",
            "    }",
            "}",
        ),
    },
    {
        name: "an Allman object argument with a trailing comma",
        code: code(
            "export async function add(table, principal, amount, extra)",
            "{",
            "    await table.merge(",
            "    {",
            "        partitionKey: principal.userId,",
            "        [principal.field]: amount,",
            "        ...extra,",
            "    });",
            "}",
        ),
    },
    {
        name: "a namespace import before a named import",
        code: code(
            'import * as THREE from "three";',
            'import { Foo } from "./foo.js";',
            "",
            "export const SCENE = new THREE.Scene(Foo);",
        ),
    },
    {
        name: "a section banner and a sub-section banner",
        code: code(
            STARS,
            "/* SECTION                                                                    */",
            STARS,
            "",
            "export const FIRST = 1;",
            "",
            "/* SUB-SECTION ****************************************************************/",
            "",
            "export const SECOND = 2;",
        ),
    },
    {
        name: "single quotes that avoid an escape, and template literals",
        code: code(
            "export function greet(name)",
            "{",
            "    return 'say \"hi\" ' + `to ${name}`;",
            "}",
        ),
    },
    {
        name: "constants in UPPER_SNAKE_CASE",
        code: code("export const MAX_PARTY_SIZE = 4;"),
    },
    {
        name: "browser globals in a game module",
        code: code(
            "export function start(update)",
            "{",
            "    document.body.dataset.ready = String(window.devicePixelRatio);",
            "    requestAnimationFrame(update);",
            "}",
        ),
    },
    {
        name: "console in the Log module",
        file: "js/log.js",
        code: code(
            "export class Log",
            "{",
            "    static info(...parts)",
            "    {",
            "        console.info(...parts);",
            "    }",
            "}",
        ),
    },
    {
        name: "Node globals in a tool",
        file: "tools/serve.js",
        code: code("export const PORT = Number(process.env.PORT ?? 8080);"),
    },
];


/******************************************************************************/
/* TESTS                                                                      */
/******************************************************************************/

const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: path.join(ROOT, "eslint.config.js") });

async function lint(entry)
{
    const filePath = path.join(ROOT, entry.file ?? "js/sample.js");
    const [result] = await eslint.lintText(entry.code, { filePath });

    return result.messages;
}

describe("eslint.config.js", () =>
{
    describe("reports broken code", () =>
    {
        for(const entry of BROKEN)
        {
            it(entry.name, async () =>
            {
                const rules = new Set((await lint(entry)).map((message) => message.ruleId));

                assert.deepEqual([...rules], [entry.rule]);
            });
        }
    });

    describe("allows correct code", () =>
    {
        for(const entry of ALLOWED)
        {
            it(entry.name, async () =>
            {
                assert.deepEqual(await lint(entry), []);
            });
        }
    });
});
