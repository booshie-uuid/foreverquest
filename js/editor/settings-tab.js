/******************************************************************************/
/* SETTINGS TAB                                                               */
/******************************************************************************/

// `options` gives the tool bar's option groups each time the bar draws.
export class SettingsTab
{
    constructor(editor, { name, title, hint, options })
    {
        this.editor = editor;
        this.tabName = name;
        this.title = title;
        this.hint = hint;
        this.options = options;
    }

    get name()
    {
        return this.tabName;
    }

    toolbar()
    {
        return { options: this.options() };
    }

    palette()
    {
        return { title: this.title, hint: this.hint };
    }

    hover()
    {
        this.editor.marks.hideGhost();
    }

    click()
    {
    }

    wheel()
    {
    }

    key()
    {
        return false;
    }
}
