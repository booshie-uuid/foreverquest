import * as THREE from "three";
import { ZoneData } from "../sim/zone-data.js";

const CUBE = 1 / ZoneData.CUBES_PER_METRE;
const STATUSES = [["open", "Open"], ["answered", "Answered"], ["done", "Done"]];
const PIN_RANGE = 120;


/******************************************************************************/
/* NOTE TOOL                                                                  */
/******************************************************************************/

// Notes are { id, cell, view, text, status, created, reply, selected }, with
// `view` the camera's when the note was written.
export class NoteTool
{
    constructor(editor)
    {
        this.editor = editor;
        this.notes = [];
        this.shown = new Set(["open", "answered"]);
        this.open = null;
        this.draft = null;
    }

    get name()
    {
        return "notes";
    }

    async load()
    {
        try
        {
            this.notes = await this.editor.client.notes();
        }
        catch(error)
        {
            this.editor.panel.say(error.message);
        }
    }

    toolbar()
    {
        const counts = (status) => this.notes.filter((note) => note.status === status).length;
        const filters = STATUSES.map(([id, label]) => ({ label: label + " (" + counts(id) + ")", isOn: this.shown.has(id), action: "show-" + id, onClick: () => this.toggle(id) }));

        return [filters, [{ label: "Go to next", key: "N", action: "next-note", onClick: () => this.next() }]];
    }

    toggle(status)
    {
        if(this.shown.has(status)) { this.shown.delete(status); }
        else { this.shown.add(status); }

        this.editor.redraw();
    }

    palette()
    {
        const items = this.notes.filter((note) => this.shown.has(note.status)).map((note) => ({ id: note.id, label: note.id + ". " + (note.text || "(empty)").slice(0, 40), swatch: null, isOn: this.open?.id === note.id }));

        return { title: "Notes", items, onPick: (id) => this.show(this.notes.find((note) => note.id === id), true), hint: "Click a cube to pin a note there. The note keeps this view, for Claude Code to open." };
    }

    wheel()
    {
    }

    hover(hit)
    {
        if(hit) { this.editor.marks.showGhost([...hit.cell, ...hit.cell], "note"); }
        else { this.editor.marks.hideGhost(); }
    }

    click(hit)
    {
        if(!hit) { return; }

        const selected = this.editor.selectedName();

        this.draft = { id: this.nextId(), cell: hit.cell, view: this.editor.fly.view, text: "", status: "open", created: new Date().toISOString(), ...(selected ? { selected } : {}) };
        this.show(this.draft, false);
    }

    nextId()
    {
        return this.notes.reduce((highest, note) => Math.max(highest, note.id), 0) + 1;
    }

    key(code)
    {
        if(code === "KeyN")
        {
            this.next();
            return true;
        }

        if(code === "Escape" && this.open)
        {
            this.close();
            return true;
        }

        return false;
    }

    // The next note shown after the one open, with the camera at its view.
    next()
    {
        const shown = this.notes.filter((note) => this.shown.has(note.status));

        if(shown.length === 0) { return; }

        const at = shown.indexOf(this.open);

        this.show(shown[(at + 1) % shown.length], true);
    }

    /* CARD *******************************************************************/

    show(note, isGoing)
    {
        if(!note) { return; }

        this.open = note;

        if(isGoing) { this.editor.fly.setView(note.view); }

        const isDraft = note === this.draft;
        const where = this.editor.zone.id + " · cell " + note.cell.join(", ") + (note.selected ? " · selected: " + note.selected : "");
        const actions = note.status === "answered" ?
        [
            { label: "Mark done", action: "note-done", onClick: () => this.setStatus(note, "done") },
            { label: "Reopen", action: "note-reopen", onClick: () => this.setStatus(note, "open") },
        ] :
        [
            { label: isDraft ? "Save note" : "Save", isOn: true, action: "note-save", onClick: () => this.keep(note) },
            { label: "Retake view", action: "note-view", onClick: () => this.retake(note) },
        ];

        actions.push({ label: isDraft ? "Cancel" : "Delete", action: "note-delete", onClick: () => this.remove(note) });

        this.editor.panel.setCard(
        {
            title: "Note " + note.id + " · " + note.status,
            text: note.text,
            isEditable: note.status !== "answered" && note.status !== "done",
            reply: note.reply,
            detail: where,
            actions,
        }, (text) => { note.text = text; });
        this.editor.redraw();
    }

    close()
    {
        this.open = null;
        this.draft = null;
        this.editor.panel.setCard(null);
        this.editor.redraw();
    }

    async keep(note)
    {
        if(note === this.draft)
        {
            this.notes.push(note);
            this.draft = null;
        }

        await this.persist();
        this.close();
    }

    retake(note)
    {
        note.view = this.editor.fly.view;
        this.editor.panel.say("The note keeps this view now. Save to keep it.");
    }

    async setStatus(note, status)
    {
        note.status = status;
        await this.persist();
        this.close();
    }

    async remove(note)
    {
        const isSaved = this.notes.includes(note);

        this.notes = this.notes.filter((entry) => entry !== note);
        this.close();

        if(isSaved) { await this.persist(); }
    }

    async persist()
    {
        try
        {
            await this.editor.client.saveNotes(this.notes);
        }
        catch(error)
        {
            this.editor.panel.say("The notes could not be saved: " + error.message);
        }
    }

    /* PINS *******************************************************************/

    // Each shown note's pin, at the top of its cube, in screen pixels.
    pins(camera, size)
    {
        const zone = this.editor.zone;
        const point = new THREE.Vector3();
        const notes = this.notes.filter((note) => this.shown.has(note.status));

        if(this.draft) { notes.push(this.draft); }

        return notes.flatMap((note) =>
        {
            const [x, y, z] = note.cell;

            point.set((x + 0.5) * CUBE - zone.half, zone.metresY(y + 1), (z + 0.5) * CUBE - zone.half);

            if(camera.position.distanceTo(point) > PIN_RANGE) { return []; }

            point.project(camera);

            if(point.z > 1) { return []; }

            return [{ id: note.id, label: String(note.id), status: note.status, x: (point.x * 0.5 + 0.5) * size.width, y: (-point.y * 0.5 + 0.5) * size.height, onClick: () => this.show(note, false) }];
        });
    }
}
