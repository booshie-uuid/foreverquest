export function element(tag, className, text)
{
    const node = document.createElement(tag);

    if(className) { node.className = className; }
    if(text !== undefined) { node.textContent = text; }

    return node;
}

export function button(text, onClick, className = "button")
{
    const node = element("button", className, text);

    node.type = "button";
    node.addEventListener("click", onClick);

    return node;
}

export function row(label, control, key)
{
    const node = element("div", "row");

    if(key) { node.dataset.key = key; }

    node.append(element("span", "row-label", label), control);

    return node;
}

export function stepper(label, valueText, onStep, key)
{
    const control = element("div", "stepper");
    const value = element("span", "stepper-value", valueText);

    control.append(
        button("◀", () => onStep(-1), "stepper-arrow"),
        value,
        button("▶", () => onStep(1), "stepper-arrow"),
    );

    control.querySelector(".stepper-arrow").setAttribute("aria-label", "Previous " + label);
    control.querySelectorAll(".stepper-arrow")[1].setAttribute("aria-label", "Next " + label);

    return row(label, control, key);
}

export function swatches(label, colours, selected, onPick, key)
{
    const control = element("div", "swatches");

    for(const colour of colours)
    {
        const swatch = button("", () => onPick(colour), "swatch");

        swatch.style.background = colour;
        swatch.dataset.colour = colour;
        swatch.setAttribute("aria-label", label + " " + colour);

        if(colour === selected) { swatch.classList.add("is-selected"); }

        control.append(swatch);
    }

    return row(label, control, key);
}

export function slider(label, value, onInput, key)
{
    const control = element("input", "slider");

    control.type = "range";
    control.min = "-1";
    control.max = "1";
    control.step = "0.05";
    control.value = String(value);
    control.setAttribute("aria-label", label);
    control.addEventListener("input", () => onInput(Number(control.value)));

    return row(label, control, key);
}

export function textInput(label, value, onChange, key)
{
    const control = element("input", "text-input");

    control.type = "text";
    control.value = value;
    control.maxLength = 20;
    control.setAttribute("aria-label", label);
    control.addEventListener("input", () => onChange(control.value, control));

    return row(label, control, key);
}

// Returns the toggles' element, and a dispose function that stops them
// following the settings.
export function graphicsToggles(graphics)
{
    const group = element("div", "toggle-group");
    const retro = button("Retro", () => graphics.toggleRetro(), "toggle");
    const stepped = button("Stepped", () => graphics.toggleStepped(), "toggle");
    const refresh = () =>
    {
        retro.classList.toggle("is-active", graphics.isRetro);
        stepped.classList.toggle("is-active", graphics.isStepped);
    };

    retro.dataset.action = "retro";
    retro.title = "Render 640 pixels wide and scale up with hard pixel edges";
    stepped.dataset.action = "stepped";
    stepped.title = "Light the world in steps, in the zone's own colours";
    refresh();
    group.append(retro, stepped);

    return { element: group, dispose: graphics.onChange(refresh) };
}
