import * as Controls from "../ui/controls.js";


/******************************************************************************/
/* EDITOR PANEL                                                               */
/******************************************************************************/

export class EditorPanel
{
    constructor(container)
    {
        this.element = Controls.element("div", "editor");
        this.toolbar = Controls.element("div", "panel editor-bar");
        this.palette = Controls.element("div", "panel editor-palette");
        this.inspector = Controls.element("div", "panel editor-inspector");
        this.status = Controls.element("div", "panel editor-status");
        this.pins = Controls.element("div", "editor-pins");
        this.card = Controls.element("div", "panel editor-card");
        this.message = Controls.element("div", "editor-message");
        this.messageTimer = null;

        this.inspector.hidden = true;
        this.card.hidden = true;
        this.message.hidden = true;
        this.element.hidden = true;
        this.element.append(this.pins, this.toolbar, this.palette, this.inspector, this.status, this.card, this.message);
        container.append(this.element);
    }

    show()
    {
        this.element.hidden = false;
    }

    hide()
    {
        this.element.hidden = true;
    }

    dispose()
    {
        clearTimeout(this.messageTimer);
        this.element.remove();
    }

    /* TOOL BAR ***************************************************************/

    // `groups` is a list of groups, each a list of { label, key, isOn,
    // isDisabled, action, onClick }.
    setToolbar(groups)
    {
        const parts = [];

        groups.forEach((group, i) =>
        {
            if(i > 0) { parts.push(Controls.element("span", "editor-sep")); }

            for(const item of group) { parts.push(EditorPanel.button(item)); }
        });

        this.toolbar.replaceChildren(...parts);
    }

    static button({ label, key, isOn = false, isDisabled = false, isWarning = false, action, onClick })
    {
        const button = Controls.button(label, onClick, "editor-button");

        button.classList.toggle("is-on", isOn);
        button.classList.toggle("is-warning", isWarning);
        button.disabled = isDisabled;

        if(action) { button.dataset.action = action; }
        if(key) { button.append(Controls.element("kbd", "", key)); }

        return button;
    }

    /* PALETTE ****************************************************************/

    // `items` holds { id, label, swatch, isOn } with `swatch` an image URL or
    // null; `tabs` holds { label, isOn, onClick }.
    setPalette({ title, tabs = [], items, onPick, hint = "", footer = "", search = null })
    {
        const heading = Controls.element("h3", "", title);
        const tabRow = Controls.element("div", "editor-tabs");
        const list = Controls.element("div", items.some((item) => item.swatch) ? "editor-swatches" : "editor-list");
        const parts = [heading];

        for(const tab of tabs) { tabRow.append(EditorPanel.button({ label: tab.label, isOn: tab.isOn, onClick: tab.onClick })); }

        if(search)
        {
            const input = Controls.element("input", "editor-search");

            input.placeholder = "Search…";
            input.value = search.value;
            input.addEventListener("input", () => search.onInput(input.value));
            parts.push(input);
        }

        if(tabs.length > 0) { parts.push(tabRow); }

        for(const item of items)
        {
            const entry = Controls.element("button", item.swatch ? "editor-swatch" : "editor-item", item.swatch ? "" : item.label);

            entry.type = "button";
            entry.title = item.label;
            entry.dataset.id = item.id;
            entry.classList.toggle("is-on", item.isOn);
            entry.addEventListener("click", () => onPick(item.id));

            if(item.swatch) { entry.style.backgroundImage = "url(" + item.swatch + ")"; }

            list.append(entry);
        }

        parts.push(list);

        if(hint) { parts.push(Controls.element("div", "editor-hint", hint)); }
        if(footer) { parts.push(Controls.element("div", "editor-hint editor-footer", footer)); }

        const focused = document.activeElement?.classList.contains("editor-search");

        this.palette.replaceChildren(...parts);

        if(focused)
        {
            const input = this.palette.querySelector(".editor-search");

            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    /* INSPECTOR **************************************************************/

    // `rows` holds [label, value, isChanged]; `actions` holds button items.
    setInspector(selected)
    {
        if(!selected)
        {
            this.inspector.hidden = true;
            return;
        }

        const { title, detail, rows, note, actions, more } = selected;
        const parts = [Controls.element("h3", "", title)];

        if(detail) { parts.push(Controls.element("div", "editor-hint", detail)); }

        for(const [label, value, isChanged] of rows)
        {
            const row = Controls.element("div", "editor-row");

            row.append(Controls.element("b", "", label), Controls.element("span", isChanged ? "is-changed" : "", value));
            parts.push(row);
        }

        if(note) { parts.push(Controls.element("div", "editor-hint is-changed", note)); }

        for(const group of [actions, more].filter((items) => items?.length > 0))
        {
            const row = Controls.element("div", "editor-actions");

            for(const item of group) { row.append(EditorPanel.button(item)); }

            parts.push(row);
        }

        this.inspector.replaceChildren(...parts);
        this.inspector.hidden = false;
    }

    /* STATUS *****************************************************************/

    setStatus(parts, unsaved)
    {
        const items = parts.map((text) => Controls.element("span", "", text));

        if(unsaved) { items.push(Controls.element("span", "editor-dirty", unsaved)); }

        this.status.replaceChildren(...items);
    }

    say(text)
    {
        clearTimeout(this.messageTimer);
        this.message.textContent = text;
        this.message.hidden = false;
        this.messageTimer = setTimeout(() => { this.message.hidden = true; }, 5000);
    }

    /* NOTES ******************************************************************/

    // `pins` holds { id, label, x, y, status, onClick } in screen pixels.
    setPins(pins)
    {
        while(this.pins.children.length > pins.length) { this.pins.lastChild.remove(); }
        while(this.pins.children.length < pins.length)
        {
            const pin = Controls.element("button", "editor-pin");

            pin.type = "button";
            pin.addEventListener("click", () => pin.onPick?.());
            this.pins.append(pin);
        }

        pins.forEach((spec, i) =>
        {
            const pin = this.pins.children[i];

            pin.textContent = spec.label;
            pin.dataset.status = spec.status;
            pin.style.left = spec.x + "px";
            pin.style.top = spec.y + "px";
            pin.onPick = spec.onClick;
        });
    }

    // `note` holds { title, text, isEditable, reply, detail, actions }; null
    // closes the card. `onText(text)` follows the note's text as it is typed.
    setCard(note, onText = null)
    {
        if(!note)
        {
            this.card.hidden = true;
            return;
        }

        const parts = [Controls.element("h3", "", note.title)];

        if(note.isEditable)
        {
            const text = Controls.element("textarea", "editor-note-text");

            text.value = note.text;
            text.placeholder = "What should change here?";
            text.addEventListener("input", () => onText?.(text.value));
            parts.push(text);
            setTimeout(() => text.focus(), 0);
        }
        else
        {
            parts.push(Controls.element("div", "editor-note-body", note.text));
        }

        if(note.reply) { parts.push(Controls.element("div", "editor-reply", "Claude Code: " + note.reply)); }
        if(note.detail) { parts.push(Controls.element("div", "editor-hint", note.detail)); }

        const row = Controls.element("div", "editor-actions");

        for(const item of note.actions) { row.append(EditorPanel.button(item)); }

        parts.push(row);
        this.card.replaceChildren(...parts);
        this.card.hidden = false;
    }
}
