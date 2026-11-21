import { BannerWidth } from "./rules/banner-width.js";

// ESLint rejects a rule that is not a plain object, and a class is a function.
function asRule(RuleClass)
{
    return { meta: RuleClass.meta, create: (context) => RuleClass.create(context) };
}

export default {
    meta: { name: "local" },
    rules: {
        "banner-width": asRule(BannerWidth),
    },
};
