const CLICK_SLOP = 6;
const LEFT_AND_RIGHT = 3;

export class Input
{
    constructor(canvas)
    {
        this.canvas = canvas;
        this.keys = new Set();
        this.drag = null;
        this.buttons = 0;
        this.listeners = { click: [], inspect: [], orbit: [], zoom: [], key: [] };
        this.handlers = [];
    }

    attach()
    {
        this.listen(window, "keydown", (event) => this.onKeyDown(event));
        this.listen(window, "keyup", (event) => this.keys.delete(event.code));
        this.listen(window, "blur", () => this.keys.clear());
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
        return codes.some((code) => this.keys.has(code));
    }

    get isHoldingBothButtons()
    {
        return (this.buttons & LEFT_AND_RIGHT) === LEFT_AND_RIGHT;
    }

    /* EVENTS *****************************************************************/

    onKeyDown(event)
    {
        if(event.target instanceof HTMLInputElement) { return; }

        if(!this.keys.has(event.code)) { this.emit("key", event.code); }

        this.keys.add(event.code);

        if(event.code.startsWith("Arrow") || event.code === "Space") { event.preventDefault(); }
    }

    // A second button pressed or released while one is held reports itself in
    // a pointer move, not a pointer down or up.
    onPointerDown(event)
    {
        this.buttons = event.buttons;
        this.drag = { button: event.button, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, hasMoved: false };
    }

    onPointerMove(event)
    {
        const drag = this.drag;

        this.buttons = event.buttons;

        if(!drag) { return; }

        drag.wasBoth ||= this.isHoldingBothButtons;

        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;

        drag.x = event.clientX;
        drag.y = event.clientY;

        if(Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > CLICK_SLOP) { drag.hasMoved = true; }
        if(drag.hasMoved) { this.emit("orbit", dx, dy); }
    }

    onPointerUp(event)
    {
        const drag = this.drag;

        this.drag = null;
        this.buttons = event.buttons;

        if(!drag || drag.hasMoved || drag.wasBoth) { return; }

        const bounds = this.canvas.getBoundingClientRect();

        if(drag.button === 0) { this.emit("click", event.clientX - bounds.left, event.clientY - bounds.top); }
        if(drag.button === 2) { this.emit("inspect", event.clientX - bounds.left, event.clientY - bounds.top); }
    }

    onWheel(event)
    {
        event.preventDefault();
        this.emit("zoom", event.deltaY > 0 ? 1.12 : 1 / 1.12);
    }
}
