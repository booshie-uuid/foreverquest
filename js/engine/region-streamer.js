import * as RegionCodec from "../sim/region-codec.js";
import { Log } from "../log.js";
import { ZoneData } from "../sim/zone-data.js";

const KEEP_MARGIN = 32;
const VIEW_MARGIN = 2 * RegionCodec.CHUNK / ZoneData.CUBES_PER_METRE;


/******************************************************************************/
/* REGION STREAMER                                                            */
/******************************************************************************/

export class RegionStreamer
{
    constructor(source, zone, radius)
    {
        this.source = source;
        this.zone = zone;
        this.radius = radius;
        this.loading = new Map();
        this.failed = new Set();
        this.isDisposed = false;
    }

    static async open(source, id, blocks)
    {
        const zone = new ZoneData(await source.json("zones/" + id + "/index.json"), [], blocks);
        const streamer = new RegionStreamer(source, zone, zone.lighting.fog.far + VIEW_MARGIN);

        await streamer.settle(zone.spawn.x, zone.spawn.z);

        return streamer;
    }

    get isIdle()
    {
        return this.loading.size === 0;
    }

    distanceTo(name, x, z)
    {
        const [left, top] = ZoneData.regionCorner(name).map((cells) => cells / ZoneData.CUBES_PER_METRE - this.zone.half);
        const size = RegionCodec.REGION / ZoneData.CUBES_PER_METRE;
        const dx = Math.max(left - x, 0, x - (left + size));
        const dz = Math.max(top - z, 0, z - (top + size));

        return Math.hypot(dx, dz);
    }

    wanted(x, z)
    {
        return this.zone.regionNames.filter((name) => this.distanceTo(name, x, z) <= this.radius);
    }

    update(x, z)
    {
        if(this.isDisposed) { return; }

        for(const name of this.wanted(x, z))
        {
            if(!this.zone.hasRegion(name) && !this.loading.has(name) && !this.failed.has(name)) { this.loading.set(name, this.load(name)); }
        }

        for(const name of [...this.zone.regions.keys()])
        {
            if(this.distanceTo(name, x, z) > this.radius + KEEP_MARGIN) { this.zone.removeRegion(name); }
        }
    }

    async settle(x, z)
    {
        this.update(x, z);
        await Promise.all(this.loading.values());
    }

    async load(name)
    {
        try
        {
            const decoded = RegionCodec.decode(await this.source.inflated("zones/" + this.zone.id + "/" + name + ".bin"));

            if(!this.isDisposed) { this.zone.addRegion({ name, ...decoded }); }
        }
        catch(error)
        {
            this.failed.add(name);
            Log.error("Could not load region " + name + " of " + this.zone.id + "; the player cannot enter it", error);
        }
        finally
        {
            this.loading.delete(name);
        }
    }

    dispose()
    {
        this.isDisposed = true;
    }
}
