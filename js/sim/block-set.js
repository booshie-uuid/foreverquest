const AIR = 0;

// Block numbers start at 1, in the baked order; 0 is air.
export class BlockSet
{
    static AIR = AIR;

    constructor(blocks)
    {
        this.blocks = [null, ...blocks];
        this.numbers = new Map(blocks.map((block, i) => [block.id, i + 1]));
        this.solid = Uint8Array.from(this.blocks, (block) => (block && block.kind !== "liquid" ? 1 : 0));
        this.opaque = Uint8Array.from(this.blocks, (block) => (block?.kind === "solid" ? 1 : 0));
        this.lights = Uint8Array.from(this.blocks, (block) => block?.light ?? 0);
        this.glows = new Float32Array(this.blocks.length * 3);

        this.blocks.forEach((block, number) =>
        {
            if(!block?.glow) { return; }

            for(let channel = 0; channel < 3; channel++) { this.glows[number * 3 + channel] = parseInt(block.glow.slice(1 + channel * 2, 3 + channel * 2), 16) / 255; }
        });
    }

    static async load(source)
    {
        return new BlockSet(await source.json("blocks.json"));
    }

    get count()
    {
        return this.blocks.length - 1;
    }

    number(id)
    {
        const found = this.numbers.get(id);

        if(found === undefined) { throw new Error("Unknown block: " + id); }

        return found;
    }

    block(number)
    {
        return this.blocks[number] ?? null;
    }

    isSolid(number)
    {
        return this.solid[number] === 1;
    }

    isOpaque(number)
    {
        return this.opaque[number] === 1;
    }

    isLiquid(number)
    {
        return this.blocks[number]?.kind === "liquid";
    }

    // The colour of a glowing block's light as 0xrrggbb.
    glowKey(number)
    {
        const channel = (index) => Math.round(this.glows[number * 3 + index] * 255);

        return channel(0) * 65536 + channel(1) * 256 + channel(2);
    }

    light(number)
    {
        return this.lights[number];
    }
}
