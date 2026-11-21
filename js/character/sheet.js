import * as THREE from "three";
import { BlockBuilder } from "../geometry/block-builder.js";
import { Raster } from "../engine/raster.js";

export class Sheet
{
    constructor(width = 256)
    {
        this.width = width;
        this.height = 0;
        this.cursorX = 0;
        this.cursorY = 0;
        this.shelfHeight = 0;
        this.raster = null;
        this.glow = null;
    }

    reserve(size)
    {
        const areas = {};

        for(const face of BlockBuilder.FACES)
        {
            const [width, height] = BlockBuilder.faceSize(face.name, size);

            areas[face.name] = this.allocate(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
        }

        return areas;
    }

    allocate(width, height)
    {
        if(width > this.width) { throw new Error("A face is wider than the sheet: " + width); }

        if(this.cursorX + width > this.width)
        {
            this.cursorY += this.shelfHeight;
            this.cursorX = 0;
            this.shelfHeight = 0;
        }

        const area = { x: this.cursorX, y: this.cursorY, w: width, h: height };

        this.cursorX += width;
        this.shelfHeight = Math.max(this.shelfHeight, height);
        this.height = this.cursorY + this.shelfHeight;

        return area;
    }

    open()
    {
        const height = Math.ceil(this.height / 16) * 16;

        this.raster = new Raster(this.width, height);
        this.glow = new Raster(this.width, height);
    }

    // Insets by a hundredth of a texel, so nearest sampling at a face's edge
    // never reads the neighbouring face.
    uv(area)
    {
        const inset = 0.01;
        const height = this.raster.height;

        return [
            (area.x + inset) / this.width,
            1 - (area.y + area.h - inset) / height,
            (area.x + area.w - inset) / this.width,
            1 - (area.y + inset) / height,
        ];
    }

    toTextures()
    {
        return { map: Sheet.texture(this.raster), glow: Sheet.texture(this.glow) };
    }

    // Rows are painted top-down but uploaded bottom-up, so the order flips.
    static texture(raster)
    {
        const rowBytes = raster.width * 4;
        const flipped = new Uint8Array(raster.data.length);

        for(let y = 0; y < raster.height; y++)
        {
            flipped.set(raster.data.subarray(y * rowBytes, (y + 1) * rowBytes), (raster.height - 1 - y) * rowBytes);
        }

        const texture = new THREE.DataTexture(flipped, raster.width, raster.height, THREE.RGBAFormat);

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;

        return texture;
    }
}
