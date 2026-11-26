import * as Controls from "../ui/controls.js";


/******************************************************************************/
/* FIELDS                                                                     */
/******************************************************************************/

// `setting` holds { key, label, unit, min, max, step }; a value out of range
// is brought into it.
export function numberField(setting, value, onChange)
{
    const input = Controls.element("input", "editor-number");

    input.type = "number";
    input.min = setting.min;
    input.max = setting.max;
    input.step = setting.step;
    input.value = value;
    input.dataset.key = setting.key;
    input.addEventListener("change", () =>
    {
        const number = Number(input.value);

        if(input.value !== "" && Number.isFinite(number)) { onChange(Math.max(setting.min, Math.min(setting.max, number))); }
    });

    return labelled(setting.label + (setting.unit ? " (" + setting.unit + ")" : ""), input);
}

// `choices` holds [value, text] pairs.
export function choiceField(key, label, choices, value, onChange)
{
    const select = Controls.element("select", "editor-choice");

    for(const [choice, text] of choices)
    {
        const option = Controls.element("option", "", text);

        option.value = choice;
        select.append(option);
    }

    select.value = value;
    select.dataset.key = key;
    select.addEventListener("change", () => onChange(select.value));

    return labelled(label, select);
}

function labelled(text, control)
{
    const field = Controls.element("label", "editor-field");

    field.append(Controls.element("span", "", text), control);

    return field;
}
