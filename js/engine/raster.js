export class Raster
{
    constructor(width, height)
    {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
    }

    index(x, y)
    {
        const px = Math.floor(x);
        const py = Math.floor(y);

        if(px < 0 || py < 0 || px >= this.width || py >= this.height) { return -1; }

        return (py * this.width + px) * 4;
    }

    get(x, y)
    {
        const i = this.index(x, y);

        return i < 0 ? [0, 0, 0, 0] : [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
    }

    set(x, y, rgba)
    {
        const i = this.index(x, y);

        if(i < 0) { return; }

        this.data[i] = rgba[0];
        this.data[i + 1] = rgba[1];
        this.data[i + 2] = rgba[2];
        this.data[i + 3] = rgba[3];
    }
}
