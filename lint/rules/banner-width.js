const WIDTH = 80;
const WORD = "[A-Z0-9&'(),./:-]+";
const TITLE = `(?=[^A-Z]*[A-Z])${WORD}(?: +${WORD})*`;
const STAR_LINE = /^\*+$/;
const SUB_SECTION = new RegExp(`^ (${TITLE}) \\*+$`);
const SECTION_TITLE = new RegExp(`^ (${TITLE}) +$`);

export class BannerWidth
{
    static meta = {
        type: "layout",
        docs: { description: "Require banner comments to end at column 80." },
        fixable: "code",
        schema: [],
        messages: { width: "Banner ends at column {{column}}; it must end at column {{width}}." },
    };

    static create(context)
    {
        const sourceCode = context.sourceCode;

        return {
            Program()
            {
                for(const comment of sourceCode.getAllComments()) { BannerWidth.check(context, comment); }
            },
        };
    }

    static check(context, comment)
    {
        const banner = BannerWidth.parse(comment);
        if(!banner || comment.loc.end.column === WIDTH) { return; }

        context.report(
        {
            loc: comment.loc,
            messageId: "width",
            data: { column: comment.loc.end.column, width: WIDTH },
            fix: (fixer) => BannerWidth.fix(fixer, comment, banner),
        });
    }

    static parse(comment)
    {
        const isOwnLine = comment.loc.start.column === 0 && comment.loc.start.line === comment.loc.end.line;
        if(comment.type !== "Block" || !isOwnLine) { return null; }

        if(STAR_LINE.test(comment.value)) { return { head: "/", fill: "*", tail: "/" }; }

        const subSection = SUB_SECTION.exec(comment.value);
        if(subSection) { return { head: "/* " + subSection[1] + " ", fill: "*", tail: "*/" }; }

        const sectionTitle = SECTION_TITLE.exec(comment.value);
        if(sectionTitle) { return { head: "/* " + sectionTitle[1], fill: " ", tail: "*/" }; }

        return null;
    }

    static fix(fixer, comment, banner)
    {
        const fillCount = WIDTH - banner.head.length - banner.tail.length;
        if(fillCount < 1) { return null; }

        return fixer.replaceText(comment, banner.head + banner.fill.repeat(fillCount) + banner.tail);
    }
}
