// A browser's image decoder may convert colour spaces or premultiply alpha,
// which changes texels. https://www.w3.org/TR/png-3/

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const RGBA = 6;
const CHANNELS = 4;

export async function decode(bytes)
{
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const chunks = readChunks(data);
    const header = readHeader(chunks.IHDR);
    const inflated = await inflate(chunks.IDAT);
    const stride = header.width * CHANNELS;

    if(inflated.length !== header.height * (stride + 1)) { throw new Error("The PNG data does not match its size: " + header.width + " by " + header.height); }

    return { width: header.width, height: header.height, data: unfilter(inflated, header.width, header.height) };
}

function readChunks(data)
{
    if(!SIGNATURE.every((value, i) => data[i] === value)) { throw new Error("The file is not a PNG"); }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const chunks = { IHDR: null, IDAT: [] };

    for(let offset = SIGNATURE.length; offset < data.length;)
    {
        const length = view.getUint32(offset);
        const type = String.fromCharCode(...data.subarray(offset + 4, offset + 8));
        const body = data.subarray(offset + 8, offset + 8 + length);

        if(type === "IHDR") { chunks.IHDR = body; }
        if(type === "IDAT") { chunks.IDAT.push(body); }
        if(type === "IEND") { break; }

        offset += 12 + length;
    }

    if(!chunks.IHDR || chunks.IDAT.length === 0) { throw new Error("The PNG has no header or no image data"); }

    return chunks;
}

function readHeader(body)
{
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    const header = { width: view.getUint32(0), height: view.getUint32(4), depth: body[8], colourType: body[9], interlace: body[12] };

    if(header.depth !== 8 || header.colourType !== RGBA || header.interlace !== 0)
    {
        throw new Error("Only 8-bit RGBA PNGs without interlacing are supported");
    }

    return header;
}

async function inflate(parts)
{
    const stream = new Blob(parts).stream().pipeThrough(new DecompressionStream("deflate"));

    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function unfilter(inflated, width, height)
{
    const stride = width * CHANNELS;
    const out = new Uint8Array(stride * height);

    for(let y = 0; y < height; y++)
    {
        const filter = inflated[y * (stride + 1)];
        const source = y * (stride + 1) + 1;
        const row = y * stride;

        for(let x = 0; x < stride; x++)
        {
            const left = x >= CHANNELS ? out[row + x - CHANNELS] : 0;
            const up = y > 0 ? out[row - stride + x] : 0;
            const upLeft = y > 0 && x >= CHANNELS ? out[row - stride + x - CHANNELS] : 0;

            out[row + x] = (inflated[source + x] + predict(filter, left, up, upLeft)) & 255;
        }
    }

    return out;
}

function predict(filter, left, up, upLeft)
{
    switch(filter)
    {
        case 0: return 0;
        case 1: return left;
        case 2: return up;
        case 3: return (left + up) >> 1;
        case 4: return paeth(left, up, upLeft);
        default: throw new Error("Unknown PNG filter: " + filter);
    }
}

function paeth(left, up, upLeft)
{
    const estimate = left + up - upLeft;
    const toLeft = Math.abs(estimate - left);
    const toUp = Math.abs(estimate - up);
    const toUpLeft = Math.abs(estimate - upLeft);

    if(toLeft <= toUp && toLeft <= toUpLeft) { return left; }

    return toUp <= toUpLeft ? up : upLeft;
}
