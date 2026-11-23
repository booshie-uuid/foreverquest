export class GraphicsSettings
{
    constructor()
    {
        this.isDay = false;
        this.listeners = [];
    }

    toggleDay()
    {
        this.isDay = !this.isDay;
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
