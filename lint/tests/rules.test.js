import { describe, it } from "node:test";
import { RuleTester } from "eslint";
import plugin from "../plugin.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const STARS = "/******************************************************************************/";
const SECTION = "/* SECTION                                                                    */";
const SUB_SECTION = "/* SUB-SECTION ****************************************************************/";
const LONG_TITLE = "A".repeat(75);

function widthError(column)
{
    return { messageId: "width", data: { column, width: 80 } };
}

new RuleTester().run("banner-width", plugin.rules["banner-width"],
{
    valid: [
        STARS,
        SUB_SECTION,
        [STARS, SECTION, STARS, "", "export const FIRST = 1;"].join("\n"),
        "/* SAVE & LOAD (V2): A/B, C.D'E ***********************************************/",
        "export function check()\n{\n    /*****/\n    return 1;\n}",
        "/* Mixed case is not a banner */",
        "/* 1234 */",
        "/** @type {number} */\nexport const COUNT = 1;",
        "/*\n * A multi-line comment\n */",
        "// SECTION ****",
        "export const COUNT = 1; /*****/",
    ],
    invalid: [
        {
            code: "/*****************************************************************************/",
            output: STARS,
            errors: [widthError(79)],
        },
        {
            code: "/********************************************************************************/",
            output: STARS,
            errors: [widthError(82)],
        },
        {
            code: "/* SUB-SECTION ***/",
            output: SUB_SECTION,
            errors: [widthError(19)],
        },
        {
            code: "/* SUB-SECTION ******************************************************************/",
            output: SUB_SECTION,
            errors: [widthError(82)],
        },
        {
            code: "/* SECTION */",
            output: SECTION,
            errors: [widthError(13)],
        },
        {
            code: "/* SECTION                                                                      */",
            output: SECTION,
            errors: [widthError(82)],
        },
        {
            code: "/* SAVE & LOAD (V2): A/B, C.D'E **/",
            output: "/* SAVE & LOAD (V2): A/B, C.D'E ***********************************************/",
            errors: [widthError(35)],
        },
        {
            code: [STARS, "/* SECTION   */", STARS].join("\n"),
            output: [STARS, SECTION, STARS].join("\n"),
            errors: [{ ...widthError(15), line: 2 }],
        },
        {
            code: "/* " + LONG_TITLE + " */",
            output: null,
            errors: [widthError(81)],
        },
        {
            code: "/* " + LONG_TITLE + " ****/",
            output: null,
            errors: [widthError(84)],
        },
    ],
});
