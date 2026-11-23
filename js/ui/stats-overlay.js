const INTERVAL_MS = 1000;

export class StatsOverlay
{
    constructor(container, app)
    {
        this.app = app;
        this.element = document.createElement("div");
        this.element.className = "frame-stats";
        this.lastFrames = app.renderer.frameCount;
        this.lastTime = performance.now();
        this.timer = setInterval(() => this.refresh(), INTERVAL_MS);
        container.append(this.element);
    }

    refresh()
    {
        const renderer = this.app.renderer;
        const now = performance.now();
        const fps = ((renderer.frameCount - this.lastFrames) * 1000) / (now - this.lastTime);
        const info = renderer.webgl.info.render;
        const zone = this.app.game?.zone;

        this.lastFrames = renderer.frameCount;
        this.lastTime = now;
        this.element.textContent = Math.round(fps) + " fps · " + Math.round(info.triangles / 1000) + "k triangles · " + info.calls + " draws" + (zone ? " · " + zone.regions.size + " regions" : "");
    }

    dispose()
    {
        clearInterval(this.timer);
        this.element.remove();
    }
}
