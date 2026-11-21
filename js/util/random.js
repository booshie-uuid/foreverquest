// Mulberry32 — a small seeded PRNG with a 2^32 period.
// https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
export class Random
{
    constructor(seed = 1)
    {
        this.state = seed >>> 0;
    }

    static fromString(text)
    {
        let hash = 2166136261;

        for(let i = 0; i < text.length; i++)
        {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }

        return new Random(hash);
    }

    next()
    {
        this.state = (this.state + 0x6D2B79F5) >>> 0;

        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min, max)
    {
        return min + this.next() * (max - min);
    }

    int(min, max)
    {
        return Math.floor(this.range(min, max + 1));
    }

    pick(items)
    {
        return items[Math.floor(this.next() * items.length)];
    }

    chance(probability)
    {
        return this.next() < probability;
    }
}
