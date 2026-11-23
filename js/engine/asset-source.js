import * as Png from "./png.js";

const MANIFEST = "manifest.json";

export class AssetSource
{
    constructor(read, manifest)
    {
        this.read = read;
        this.manifest = manifest;
    }

    static async open(read)
    {
        let bytes;

        try
        {
            bytes = await read(MANIFEST);
        }
        catch(error)
        {
            throw new Error("The asset manifest could not be read. Run npm run bake to build the assets.", { cause: error });
        }

        return new AssetSource(read, JSON.parse(new TextDecoder().decode(bytes)));
    }

    static http(baseUrl)
    {
        return AssetSource.open(async (path) =>
        {
            const response = await fetch(baseUrl + path);

            if(!response.ok) { throw new Error("Could not load " + baseUrl + path + ": " + response.status); }

            return new Uint8Array(await response.arrayBuffer());
        });
    }

    has(path)
    {
        return path in this.manifest.files;
    }

    async bytes(path)
    {
        if(!this.has(path)) { throw new Error("The asset " + path + " is not in the manifest. Run npm run bake."); }

        return new Uint8Array(await this.read(path));
    }

    async json(path)
    {
        return JSON.parse(new TextDecoder().decode(await this.bytes(path)));
    }

    async image(path)
    {
        return Png.decode(await this.bytes(path));
    }

    async inflated(path)
    {
        return Png.inflate([await this.bytes(path)]);
    }
}
