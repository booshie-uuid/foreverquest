export class StampSheet
{
    constructor(index, image)
    {
        this.width = image.width;
        this.data = image.data;
        this.rects = new Map(Object.entries(index.stamps).map(([id, stamp]) => [id, stamp.rect]));
    }

    rect(id)
    {
        const rect = this.rects.get(id);

        if(!rect) { throw new Error("Unknown stamp: " + id); }

        return rect;
    }

    texel(x, y)
    {
        const i = (y * this.width + x) * 4;

        return this.data.subarray(i, i + 4);
    }
}
