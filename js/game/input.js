const CLICK_SLOP = 6;
const LEFT_AND_RIGHT = 3;

// The operating system repeats a held key about every 30 ms; a key that had
// started repeating and then goes quiet for REPEAT_GAP was let go.
const REPEAT_GAP = 250;

export class Input
{
    constructor(canvas)
    {
        this.canvas = canvas;
        this.keys = new Set();
        this.drag = null;
        this.buttons = 0;
        this.lastKey = null;
        this.listeners = { click: [], inspect: [], pick: [], hover: [], orbit: [], zoom: [], key: [], stroke: [] };
        this.handlers = [];
        this.wantsStroke = () => false;
    }

    // While `wantsStroke()` holds, a press of the left button starts a stroke,
    // reported as "start", "move" and "end" with the pointer's place, in place
    // of a click or a look around.
    setStrokeTest(wantsStroke)
    {
        this.wantsStroke = wantsStroke;
    }

    attach()
    {
        this.listen(window, "keydown", (event) => this.onKeyDown(event));
        this.listen(window, "keyup", (event) => this.onKeyUp(event));
        this.listen(window, "blur", () => this.release());
        this.listen(window, "focus", () => this.release());
        this.listen(document, "visibilitychange", () => this.release());
        this.listen(this.canvas, "pointerdown", (event) => this.onPointerDown(event));
        this.listen(window, "pointermove", (event) => this.onPointerMove(event));
        this.listen(window, "pointerup", (event) => this.onPointerUp(event));
        this.listen(this.canvas, "wheel", (event) => this.onWheel(event), { passive: false });
        this.listen(this.canvas, "contextmenu", (event) => event.preventDefault());
    }

    detach()
    {
        for(const { target, type, handler } of this.handlers) { target.removeEventListener(type, handler); }

        this.handlers = [];
        this.release();
    }

    // Forgets every key and button held, for when their release may not reach
    // the page, as when it loses the keyboard or a button is let go outside
    // the window.
    release()
    {
        this.lastKey = null;
        this.keys.clear();
        this.drag = null;
        this.buttons = 0;
    }

    listen(target, type, handler, options)
    {
        target.addEventListener(type, handler, options);
        this.handlers.push({ target, type, handler });
    }

    on(type, listener)
    {
        this.listeners[type].push(listener);

        return () =>
        {
            this.listeners[type] = this.listeners[type].filter((entry) => entry !== listener);
        };
    }

    emit(type, ...args)
    {
        for(const listener of this.listeners[type]) { listener(...args); }
    }

    isDown(...codes)
    {
        this.forgetQuietKey();

        return codes.some((code) => this.keys.has(code));
    }

    // Only the key pressed last repeats, so it alone can be checked; a key
    // never seen repeating, as with repeat turned off, is kept.
    forgetQuietKey()
    {
        const last = this.lastKey;

        if(!last?.isRepeating || performance.now() - last.at <= REPEAT_GAP) { return; }

        this.keys.delete(last.code);
        this.lastKey = null;
    }

    get isHoldingBothButtons()
    {
        return (this.buttons & LEFT_AND_RIGHT) === LEFT_AND_RIGHT;
    }

    /* EVENTS *****************************************************************/

    onKeyDown(event)
    {
        if(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) { return; }

        if(!this.keys.has(event.code)) { this.emit("key", event.code, event); }

        if(!event.repeat) { this.lastKey = { code: event.code, at: performance.now(), isRepeating: false }; }
        else if(this.lastKey?.code === event.code) { Object.assign(this.lastKey, { at: performance.now(), isRepeating: true }); }

        this.keys.add(event.code);

        if(event.code.startsWith("Arrow") || event.code === "Space") { event.preventDefault(); }
    }

    onKeyUp(event)
    {
        this.keys.delete(event.code);

        if(this.lastKey?.code === event.code) { this.lastKey = null; }
    }

    // A second button pressed or released while one is held reports itself in
    // a pointer move, not a pointer down or up.
    // The middle button would otherwise start the browser's autoscroll.
    onPointerDown(event)
    {
        if(event.button === 1) { event.preventDefault(); }

        this.buttons = event.buttons;
        this.drag = { button: event.button, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, hasMoved: false, isStroke: event.button === 0 && this.wantsStroke() };

        if(this.drag.isStroke) { this.emitAt("stroke", event, "start"); }
    }

    emitAt(type, event, ...args)
    {
        const bounds = this.canvas.getBoundingClientRect();

        this.emit(type, ...args, event.clientX - bounds.left, event.clientY - bounds.top);
    }

    onPointerMove(event)
    {
        const drag = this.drag;

        this.buttons = event.buttons;

        const bounds = this.canvas.getBoundingClientRect();

        this.emit("hover", event.clientX - bounds.left, event.clientY - bounds.top);

        if(!drag) { return; }

        if(event.buttons === 0)
        {
            this.dropLostDrag(event);
            return;
        }

        if(drag.isStroke)
        {
            this.emitAt("stroke", event, "move");
            return;
        }

        drag.wasBoth ||= this.isHoldingBothButtons;

        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;

        drag.x = event.clientX;
        drag.y = event.clientY;

        if(Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > CLICK_SLOP) { drag.hasMoved = true; }
        if(drag.hasMoved) { this.emit("orbit", dx, dy); }
    }

    // A move with no button down means the release happened where the page
    // could not hear it, as outside the window.
    dropLostDrag(event)
    {
        const drag = this.drag;

        this.drag = null;

        if(drag.isStroke) { this.emitAt("stroke", event, "end"); }
    }

    onPointerUp(event)
    {
        const drag = this.drag;

        this.drag = null;
        this.buttons = event.buttons;

        if(drag?.isStroke)
        {
            this.emitAt("stroke", event, "end");
            return;
        }

        if(!drag || drag.hasMoved || drag.wasBoth) { return; }

        const bounds = this.canvas.getBoundingClientRect();

        if(drag.button === 0) { this.emit("click", event.clientX - bounds.left, event.clientY - bounds.top); }
        if(drag.button === 1) { this.emit("pick", event.clientX - bounds.left, event.clientY - bounds.top); }
        if(drag.button === 2) { this.emit("inspect", event.clientX - bounds.left, event.clientY - bounds.top); }
    }

    onWheel(event)
    {
        event.preventDefault();
        this.emit("zoom", event.deltaY > 0 ? 1.12 : 1 / 1.12);
    }
}
