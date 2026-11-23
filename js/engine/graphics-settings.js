export class GraphicsSettings
{
    constructor(renderer)
    {
        this.renderer = renderer;
        this.isStepped = false;
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

    toggleStepped()
    {
        this.isStepped = !this.isStepped;
        this.emitChange();
    }

    onChange(listener)
    {
        this.listeners.push(listener);

        return () =>
        {
            this.listeners = this.listeners.filter((entry) => entry !== listener);
        };
    }

    emitChange()
    {
        for(const listener of this.listeners) { listener(this); }
    }
}
