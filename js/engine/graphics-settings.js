export class GraphicsSettings
{
    constructor(renderer)
    {
        this.renderer = renderer;
        this.listeners = [];
    }

    get isRetro()
    {
        return this.renderer.isRetro;
    }

    toggleRetro()
    {
        this.renderer.setRetro(!this.isRetro);
        this.emitChange();
    }

    onChange(listener)
    {
        this.listeners.push(listener);
    }

    emitChange()
    {
        for(const listener of this.listeners) { listener(this); }
    }
}
