export const TEXEL = 1.8 / 88;

const AXES = 3;


/******************************************************************************/
/* FIT                                                                        */
/******************************************************************************/

// A linear form is { c, t } with t a list of [coefficient, box, axis] terms.
export function evaluate(form, boxes)
{
    let value = form.c;

    for(const [coefficient, box, axis] of form.t) { value += coefficient * boxes[box][axis]; }

    return value + 0;
}

export function boxes(body, variantId, sliders)
{
    const variant = body.variants.find((entry) => entry.id === variantId) ?? body.variants[0];
    const result = {};

    for(const [name, size] of Object.entries(body.boxes))
    {
        const sized = [...size];

        addTo(sized, variant.boxes[name], 1);

        for(const [sliderName, slider] of Object.entries(body.sliders))
        {
            if(slider.steps) { addTo(sized, slider.boxes[name], Math.round((sliders[sliderName] ?? 0) * slider.steps)); }
        }

        result[name] = sized;
    }

    return result;
}

function addTo(size, delta, count)
{
    if(!delta || count === 0) { return; }

    for(let axis = 0; axis < AXES; axis++) { size[axis] += delta[axis] * count; }
}

export function scale(body, sliders)
{
    const slider = body.sliders.height;

    return slider?.scale ? 1 + (sliders.height ?? 0) * slider.scale : 1;
}

// Sizes, pivots and centres are in texels before the scale applies.
export function fit(rig, body, choices)
{
    const sized = boxes(body, choices.variant, choices);
    const bones = rig.bones.map((bone) => (
    {
        name: bone.name,
        parent: bone.parent,
        box: bone.box,
        size: bone.box ? sized[bone.box] : null,
        pivot: bone.pivot.map((form) => evaluate(form, sized)),
        centre: bone.centre ? bone.centre.map((form) => evaluate(form, sized)) : null,
        rest: bone.rest,
    }));

    return { rig, body, boxes: sized, scale: scale(body, choices), bones, top: top(bones) };
}

// Ignores rest angles.
function top(bones)
{
    const byName = new Map(bones.map((bone) => [bone.name, bone]));
    const jointHeight = (bone) => bone.pivot[1] + (bone.parent === "root" ? 0 : jointHeight(byName.get(bone.parent)));
    let highest = 0;

    for(const bone of bones)
    {
        if(bone.size) { highest = Math.max(highest, jointHeight(bone) + bone.centre[1] + bone.size[1] / 2); }
    }

    return highest;
}

export function bodyBlocks(fitted)
{
    return fitted.bones.filter((bone) => bone.size).map((bone) => ({ joint: bone.name, part: bone.name, size: bone.size, at: bone.centre }));
}
