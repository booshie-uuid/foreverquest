import * as THREE from "three";

const INDEX = "textures/world.json";
const IMAGE = "textures/world.png";
const GLASS_FRAME = "iron";

export class WorldAtlas
{
    constructor(index, image)
    {
        const { size, texelsPerMetre, layers } = index;

        if(image.width !== size || image.height !== size * layers.length)
        {
            throw new Error("The world texture image is " + image.width + " by " + image.height + ", not " + size + " by " + size * layers.length);
        }

        this.size = size;
        this.texelsPerMetre = texelsPerMetre;
        this.names = layers.map((layer) => layer.name);
        this.glowLayers = layers.flatMap((layer, i) => (layer.glow ? [i] : []));
        this.frameLayer = this.names.indexOf(GLASS_FRAME);
        this.upload = WorldAtlas.flipLayers(image.data, size, layers.length);
    }

    static async load(source)
    {
        return new WorldAtlas(await source.json(INDEX), await source.image(IMAGE));
    }

    get uvPerMetre()
    {
        return this.texelsPerMetre / this.size;
    }

    layer(name)
    {
        const found = this.names.indexOf(name);

        if(found < 0) { throw new Error("Unknown world texture: " + name); }

        return found;
    }

    createTexture()
    {
        const texture = new THREE.DataArrayTexture(this.upload, this.size, this.size, this.names.length);

        texture.format = THREE.RGBAFormat;
        texture.type = THREE.UnsignedByteType;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestMipmapLinearFilter;
        texture.generateMipmaps = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

        return texture;
    }

    // Images store rows top-down and textures upload them bottom-up, so each
    // layer flips on its own.
    static flipLayers(data, size, count)
    {
        const rowBytes = size * 4;
        const layerBytes = rowBytes * size;
        const flipped = new Uint8Array(layerBytes * count);

        for(let layer = 0; layer < count; layer++)
        {
            for(let y = 0; y < size; y++)
            {
                const from = layer * layerBytes + y * rowBytes;

                flipped.set(data.subarray(from, from + rowBytes), layer * layerBytes + (size - 1 - y) * rowBytes);
            }
        }

        return flipped;
    }
}
