const FACES = ["front", "back", "left", "right", "top", "bottom"];

// Records a block in metres. `faces` is a world texture name for every face,
// or a map from face names to texture names with "all" as the fallback; a face
// mapped to null is left out. `builder.blocks` collects the records.
export function block(builder, size, at, faces, rotation = null)
{
    const nameOf = (face) => (typeof faces === "string" ? faces : faces[face] ?? faces.all ?? null);

    builder.blocks.push({ size, at, rotation, faces: Object.fromEntries(FACES.map((face) => [face, nameOf(face)])) });
}

function placed(builder, x, y, z, angle)
{
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const toWorld = (local) => [x + local[0] * cos + local[2] * sin, y + local[1], z - local[0] * sin + local[2] * cos];

    return (size, at, faces, rotation = null) =>
    {
        const turn = rotation ? [rotation[0], rotation[1] + angle, rotation[2]] : [0, angle, 0];

        block(builder, size, toWorld(at), faces, turn);
    };
}


/******************************************************************************/
/* BUILDINGS                                                                  */
/******************************************************************************/

export function house(builder, x, y, z, angle, style)
{
    const put = placed(builder, x, y, z, angle);
    const { width, depth } = style;
    const ground = 2.2;
    const upper = 2.0;
    const jetty = 0.3;
    const upperWidth = width + jetty * 2;
    const upperDepth = depth + jetty * 2;
    const lights = [];

    put([width + 0.3, 0.8, depth + 0.3], [0, 0.1, 0], "stone");
    put([width, ground, depth], [0, 0.5 + ground / 2, 0], "plaster");
    put([upperWidth, upper, upperDepth], [0, 0.5 + ground + upper / 2 + 0.1, 0], "plaster");
    put([upperWidth + 0.1, 0.2, upperDepth + 0.1], [0, 0.5 + ground + 0.1, 0], "timber");

    frame(put, width, depth, 0.5, ground, true);
    frame(put, upperWidth, upperDepth, 0.6 + ground, upper, false);

    put([0.9, 1.7, 0.12], [width * 0.18, 0.5 + 0.85, depth / 2 + 0.02], { front: "planks", all: "timber" });
    put([1.3, 0.2, 0.6], [width * 0.18, 0.4, depth / 2 + 0.3], "stone");

    for(const [wx, level, isLit] of [[-width * 0.25, 0, true], [-width * 0.25, 1, style.isLit], [width * 0.25, 1, false]])
    {
        const wy = 0.5 + (level === 0 ? 1.3 : ground + 1.2);
        const wz = (level === 0 ? depth : upperDepth) / 2 + 0.03;

        put([0.7, 0.7, 0.06], [wx, wy, wz], isLit ? "glow" : "iron");
        put([0.36, 0.76, 0.08], [wx - 0.58, wy, wz + 0.06], "planks", [0, 0.5, 0]);
        put([0.36, 0.76, 0.08], [wx + 0.58, wy, wz + 0.06], "planks", [0, -0.5, 0]);

        if(isLit && level === 0) { lights.push(local(x, y, z, angle, [wx, wy, wz + 0.8])); }
    }

    stepRoof(put, upperWidth + 0.6, upperDepth + 1.0, 0.5 + ground + upper + 0.1, style.roof, "plaster", 0.33);
    put([0.6, 3.2, 0.6], [width * 0.3, 0.5 + ground + upper + 1.2, -depth * 0.15], "stone");

    if(style.sign)
    {
        put([1.0, 0.08, 0.08], [width / 2 - 0.2, 0.5 + 2.0, depth / 2 + 0.55], "iron");
        put([0.7, 0.5, 0.06], [width / 2 - 0.1, 0.5 + 1.65, depth / 2 + 0.9], { front: "banner", all: "planks" });
    }

    return { collider: { x, z, halfWidth: upperWidth / 2 + 0.2, halfDepth: upperDepth / 2 + 0.2, angle }, lights };
}

function frame(put, width, depth, base, height, hasBraces)
{
    const postCount = Math.max(2, Math.round(width / 1.2));

    for(let i = 0; i <= postCount; i++)
    {
        const px = -width / 2 + (i / postCount) * width;

        put([0.18, height, 0.18], [px, base + height / 2, depth / 2 + 0.02], "timber");
        put([0.18, height, 0.18], [px, base + height / 2, -depth / 2 - 0.02], "timber");
    }

    for(const side of [1, -1])
    {
        put([0.18, height, 0.18], [side * (width / 2 + 0.02), base + height / 2, 0], "timber");
        put([width + 0.1, 0.16, 0.2], [0, base + height - 0.08, side * (depth / 2 + 0.03)], "timber");
    }

    if(!hasBraces) { return; }

    put([0.14, height * 0.95, 0.12], [-width / 2 + 0.55, base + height / 2, depth / 2 + 0.05], "timber", [0, 0, 0.55]);
    put([0.14, height * 0.95, 0.12], [width / 2 - 0.55, base + height / 2, depth / 2 + 0.05], "timber", [0, 0, -0.55]);
}

function stepRoof(put, width, depth, base, roof, gable, inset)
{
    for(let step = 0; ; step++)
    {
        const slabDepth = depth - step * inset * 2;

        if(slabDepth <= 0.3) { break; }

        put([width, 0.25, slabDepth], [0, base + step * 0.25 + 0.125, 0], roof);

        if(gable && slabDepth - 1.0 > 0.2) { put([width - 0.8, 0.25, slabDepth - 1.0], [0, base + step * 0.25 + 0.125, 0], gable); }
    }
}

function local(x, y, z, angle, point)
{
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return [x + point[0] * cos + point[2] * sin, y + point[1], z - point[0] * sin + point[2] * cos];
}

export function cottage(builder, x, y, z, angle)
{
    const put = placed(builder, x, y, z, angle);

    put([4.4, 0.6, 3.6], [0, 0.0, 0], "darkStone");
    put([4.2, 2.2, 3.4], [0, 1.4, 0], "stone");
    put([0.9, 1.6, 0.1], [0.8, 1.1, 1.72], { front: "oldPlanks", all: "timber" });
    put([0.6, 0.6, 0.06], [-1.1, 1.5, 1.72], "glow");
    stepRoof(put, 5.0, 4.6, 2.5, "thatch", "stone", 0.38);

    return { collider: { x, z, halfWidth: 2.5, halfDepth: 2.1, angle }, lights: [local(x, y, z, angle, [-1.1, 1.5, 2.4])] };
}

export function chapel(builder, x, y, z, angle)
{
    const put = placed(builder, x, y, z, angle);

    put([6.4, 0.8, 9.4], [0, 0.1, 0], "darkStone");
    put([6, 4.6, 9], [0, 2.8, 0], "darkStone");

    for(const side of [1, -1])
    {
        for(const wz of [-2.5, 0, 2.5])
        {
            put([0.08, 1.8, 0.6], [side * 3.03, 2.8, wz], "glow");
            put([0.3, 5, 0.6], [side * 3.1, 2.6, wz + 1.25], "stone");
        }
    }

    put([1.4, 2.6, 0.12], [0, 1.8, 4.52], { front: "oldPlanks", all: "timber" });
    put([2.0, 0.4, 0.4], [0, 3.3, 4.55], "stone");
    stepRoof(put, 7.0, 9.8, 5.1, "slate", "darkStone", 0.26);
    put([2.4, 4.2, 2.4], [0, 7.4, 4.0], "darkStone");
    put([0.6, 0.9, 0.06], [0, 8.2, 5.22], "iron");
    stepRoof(put, 2.8, 2.8, 9.5, "slate", "darkStone", 0.3);
    put([0.18, 1.6, 0.18], [0, 11.6, 4.0], "iron");
    put([0.9, 0.18, 0.18], [0, 11.9, 4.0], "iron");

    for(const side of [1, -1])
    {
        put([0.12, 3.2, 0.12], [side * 1.4, 1.6, 5.6], "timber");
        put([0.08, 1.4, 0.7], [side * 1.4, 2.4, 5.95], { left: "banner", right: "banner", all: "banner" });
    }

    return { collider: { x, z, halfWidth: 3.3, halfDepth: 4.8, angle }, lights: [local(x, y, z, angle, [0, 2.2, 5.4])] };
}


/******************************************************************************/
/* VILLAGE PROPS                                                              */
/******************************************************************************/

export function well(builder, x, y, z)
{
    const put = placed(builder, x, y, z, 0);

    for(let i = 0; i < 8; i++)
    {
        const angle = (i / 8) * Math.PI * 2;

        put([0.7, 0.8, 0.35], [Math.cos(angle) * 0.85, 0.4, Math.sin(angle) * 0.85], "stone", [0, -angle + Math.PI / 2, 0]);
    }

    put([1.5, 0.1, 1.5], [0, 0.3, 0], "mud");

    for(const side of [1, -1]) { put([0.16, 2.0, 0.16], [side * 0.95, 1.0, 0], "timber"); }

    put([2.1, 0.12, 0.14], [0, 1.9, 0], "timber");
    put([0.3, 0.3, 0.3], [0, 1.4, 0], "planks");
    stepRoof(put, 2.4, 1.8, 2.0, "slate", null, 0.3);

    return { x, z, radius: 1.2 };
}

export function lampPost(builder, x, y, z, angle)
{
    const put = placed(builder, x, y, z, angle);

    put([0.18, 2.8, 0.18], [0, 1.4, 0], "timber");
    put([0.7, 0.12, 0.12], [0.3, 2.7, 0], "timber");
    put([0.28, 0.36, 0.28], [0.55, 2.45, 0], "glow");
    put([0.36, 0.08, 0.36], [0.55, 2.66, 0], "iron");

    return { collider: { x, z, radius: 0.25 }, light: local(x, y, z, angle, [0.55, 2.3, 0]) };
}

export function barrel(builder, x, y, z, angle)
{
    const put = placed(builder, x, y, z, angle);

    put([0.6, 0.85, 0.6], [0, 0.425, 0], { top: "oldPlanks", all: "planks" });

    for(const band of [0.15, 0.7]) { put([0.64, 0.06, 0.64], [0, band, 0], "iron"); }

    return { x, z, radius: 0.42 };
}

export function crate(builder, x, y, z, size, angle)
{
    const put = placed(builder, x, y, z, angle);

    put([size, size, size], [0, size / 2, 0], "oldPlanks");
    put([size + 0.04, 0.08, size + 0.04], [0, size - 0.04, 0], "timber");

    return { x, z, radius: size * 0.7 };
}

export function sacks(builder, x, y, z, angle)
{
    const put = placed(builder, x, y, z, angle);

    put([0.5, 0.6, 0.4], [0, 0.3, 0], "sacking", [0, 0, 0.1]);
    put([0.5, 0.55, 0.4], [0.45, 0.27, 0.1], "sacking", [0, 0.4, -0.08]);
    put([0.5, 0.4, 0.4], [0.2, 0.75, 0.05], "sacking", [0, 0.2, 1.4]);

    return { x, z, radius: 0.6 };
}

export function cart(builder, x, y, z, angle)
{
    const put = placed(builder, x, y, z, angle);

    put([1.8, 0.12, 1.0], [0, 0.7, 0], "planks");
    put([1.8, 0.3, 0.08], [0, 0.9, 0.48], "planks");
    put([1.8, 0.3, 0.08], [0, 0.9, -0.48], "planks");
    put([1.6, 0.08, 0.08], [1.6, 0.66, 0.3], "timber");
    put([1.6, 0.08, 0.08], [1.6, 0.66, -0.3], "timber");

    for(const side of [0.6, -0.6])
    {
        for(let i = 0; i < 8; i++)
        {
            const spoke = (i / 8) * Math.PI * 2;

            put([0.26, 0.09, 0.08], [Math.cos(spoke) * 0.38 - 0.2, 0.42 + Math.sin(spoke) * 0.38, side], "timber", [0, 0, spoke + Math.PI / 2]);
        }

        put([0.7, 0.06, 0.06], [-0.2, 0.42, side], "timber", [0, 0, 0.6]);
        put([0.7, 0.06, 0.06], [-0.2, 0.42, side], "timber", [0, 0, -0.9]);
    }

    put([0.4, 0.3, 0.3], [-0.3, 0.92, 0.1], "sacking", [0, 0, 0.3]);
    put([0.4, 0.3, 0.3], [0.2, 0.92, -0.15], "sacking", [0, 0.5, 0.2]);

    return { collider: { x, z, halfWidth: 1.4, halfDepth: 0.7, angle } };
}

export function fence(builder, points, heightAt)
{
    const colliders = [];

    for(let i = 0; i < points.length - 1; i++)
    {
        const [ax, az] = points[i];
        const [bx, bz] = points[i + 1];
        const length = Math.hypot(bx - ax, bz - az);
        const posts = Math.max(1, Math.round(length / 1.4));
        const angle = Math.atan2(bx - ax, bz - az);

        for(let j = 0; j <= posts; j++)
        {
            const px = ax + (bx - ax) * (j / posts);
            const pz = az + (bz - az) * (j / posts);

            block(builder, [0.14, 1.0, 0.14], [px, heightAt(px, pz) + 0.45, pz], "timber", [0, 0, (j % 3 - 1) * 0.06]);
            colliders.push({ x: px, z: pz, radius: 0.3 });
        }

        for(let j = 0; j < posts; j++)
        {
            const mx = ax + (bx - ax) * ((j + 0.5) / posts);
            const mz = az + (bz - az) * ((j + 0.5) / posts);
            const my = heightAt(mx, mz);
            const isBroken = (i + j) % 5 === 3;

            block(builder, [0.08, 0.08, length / posts], [mx, my + 0.72, mz], "timber", [0, angle, 0]);
            block(builder, [0.08, 0.08, length / posts], [mx, my + (isBroken ? 0.1 : 0.35), mz], "timber", [isBroken ? 0.4 : 0, angle, 0]);
        }
    }

    return colliders;
}

export function stocks(builder, x, y, z, angle)
{
    const put = placed(builder, x, y, z, angle);

    put([1.8, 0.25, 0.8], [0, 0.12, 0], "oldPlanks");

    for(const side of [1, -1]) { put([0.16, 1.3, 0.16], [side * 0.7, 0.85, 0], "timber"); }

    put([1.6, 0.3, 0.16], [0, 1.1, 0], { front: "oldPlanks", all: "timber" });

    return { collider: { x, z, halfWidth: 0.95, halfDepth: 0.5, angle } };
}

export function signpost(builder, x, y, z, angle)
{
    const put = placed(builder, x, y, z, angle);

    put([0.14, 2.2, 0.14], [0, 1.1, 0], "timber");
    put([0.9, 0.2, 0.05], [0.35, 1.9, 0], "oldPlanks", [0, 0, 0.05]);
    put([0.8, 0.2, 0.05], [-0.3, 1.6, 0.05], "oldPlanks", [0, 1.4, -0.05]);

    return { x, z, radius: 0.2 };
}

export function gibbet(builder, x, y, z, angle)
{
    const put = placed(builder, x, y, z, angle);

    put([0.24, 3.4, 0.24], [0, 1.7, 0], "timber");
    put([1.5, 0.2, 0.2], [0.65, 3.3, 0], "timber");
    put([0.12, 0.9, 0.12], [0.3, 2.9, 0], "timber", [0, 0, 0.8]);
    put([0.03, 0.5, 0.03], [1.2, 3.0, 0], "iron");

    for(const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) { put([0.04, 0.9, 0.04], [1.2 + dx, 2.3, dz], "iron"); }

    put([0.56, 0.04, 0.56], [1.2, 1.85, 0], "iron");
    put([0.56, 0.04, 0.56], [1.2, 2.75, 0], "iron");

    return { x, z, radius: 0.3 };
}


/******************************************************************************/
/* GRAVES AND NATURE                                                          */
/******************************************************************************/

export function grave(builder, x, y, z, angle, random)
{
    const put = placed(builder, x, y, z, angle);
    const lean = random.range(-0.12, 0.12);

    put([0.6, 0.06, 1.1], [0, 0.03, 0.75], "mud");

    if(random.chance(0.25))
    {
        put([0.14, 1.2, 0.14], [0, 0.6, 0], "grave", [lean, 0, lean]);
        put([0.6, 0.14, 0.14], [0, 0.85, 0], "grave", [lean, 0, lean]);
    }
    else
    {
        put([0.55, 0.7, 0.14], [0, 0.35, 0], "grave", [lean, 0, lean * 0.6]);
        put([0.37, 0.12, 0.14], [0, 0.76, 0], "grave", [lean, 0, lean * 0.6]);
    }

    return { x, z, radius: 0.35 };
}

export function deadTree(builder, x, y, z, scale, random)
{
    const put = placed(builder, x, y, z, random.range(0, Math.PI));
    const height = 2.8 * scale;

    put([0.4 * scale, height, 0.4 * scale], [0, height / 2, 0], "bark");

    for(let i = 0; i < 4; i++)
    {
        const length = random.range(0.8, 1.4) * scale;
        const turn = random.range(0, Math.PI * 2);
        const tilt = random.range(0.5, 1.0);
        const base = height * random.range(0.5, 0.95);

        put([0.16 * scale, length, 0.16 * scale], [Math.sin(turn) * Math.sin(tilt) * length / 2, base + Math.cos(tilt) * length / 2, Math.cos(turn) * Math.sin(tilt) * length / 2], "bark", [tilt, turn, 0]);
    }

    return { x, z, radius: 0.35 * scale };
}

export function pine(builder, x, y, z, scale, random)
{
    const put = placed(builder, x, y, z, random.range(0, Math.PI / 2));
    const trunk = 1.0 * scale;

    put([0.35 * scale, trunk + 0.4, 0.35 * scale], [0, (trunk + 0.4) / 2 - 0.2, 0], "bark");

    for(let tier = 0; tier < 5; tier++)
    {
        const width = (2.4 - tier * 0.42) * scale;

        put([width, 0.7 * scale, width], [0, trunk + tier * 0.62 * scale + 0.35 * scale, 0], "needles");
    }

    put([0.3 * scale, 0.6 * scale, 0.3 * scale], [0, trunk + 3.35 * scale, 0], "needles");

    return { x, z, radius: 0.35 * scale };
}

export function oak(builder, x, y, z, scale, random)
{
    const put = placed(builder, x, y, z, random.range(0, Math.PI / 2));
    const trunk = 2.0 * scale;

    put([0.5 * scale, trunk, 0.5 * scale], [0, trunk / 2, 0], "bark");
    put([2.6 * scale, 1.6 * scale, 2.6 * scale], [0, trunk + 0.6 * scale, 0], "leaves");

    for(let i = 0; i < 4; i++)
    {
        const size = random.range(1.0, 1.5) * scale;

        put([size, size * 0.8, size], [random.range(-1, 1) * scale, trunk + random.range(0.2, 1.4) * scale, random.range(-1, 1) * scale], "leaves");
    }

    return { x, z, radius: 0.4 * scale };
}

export function rock(builder, x, y, z, scale, random)
{
    block(builder, [scale * random.range(0.8, 1.3), scale * random.range(0.4, 0.8), scale * random.range(0.8, 1.2)], [x, y + scale * 0.2, z], random.chance(0.5) ? "stone" : "darkStone", [random.range(-0.15, 0.15), random.range(0, 3), random.range(-0.15, 0.15)]);

    return { x, z, radius: scale * 0.65 };
}

export function bush(builder, x, y, z, scale, random)
{
    block(builder, [0.9 * scale, 0.6 * scale, 0.8 * scale], [x, y + 0.3 * scale, z], "leaves", [0, random.range(0, 3), 0]);
    block(builder, [0.6 * scale, 0.5 * scale, 0.6 * scale], [x + 0.35 * scale, y + 0.45 * scale, z + 0.2 * scale], "leaves", [0, random.range(0, 3), 0]);
}

export function weeds(builder, x, y, z, random)
{
    for(let i = 0; i < 3; i++)
    {
        block(builder, [0.05, random.range(0.2, 0.45), 0.05], [x + random.range(-0.2, 0.2), y + 0.15, z + random.range(-0.2, 0.2)], random.chance(0.5) ? "grass" : "moss", [random.range(-0.3, 0.3), 0, random.range(-0.3, 0.3)]);
    }
}
