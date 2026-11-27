const CUBE = 1 / 3;
const GAP = 1;
const WIDTH = 24;
const ROOM_WIDTH = 8;
const STOREY = 9;
const DOOR = [2, 7];
const ROOM = { floor: "planks", wall: "stone", roof: "slate" };
const LAMP = "candelabra";


/******************************************************************************/
/* SHOWCASE                                                                   */
/******************************************************************************/

// `showcase` is { pack, x, z }, with x, z the corner in metres. Each made
// prefab's id starts "showcase.", and the zone's bake puts the placements
// after its own props.
export function expand(showcase, context, where, problems)
{
    const catalogue = context.catalogue;

    if(!catalogue.packs.some(([id]) => id === showcase.pack))
    {
        problems.push(where + " shows an unknown pack: " + showcase.pack);
        return { props: [], prefabs: {} };
    }

    const blocks = Object.keys(catalogue.blocks).filter((id) => catalogue.blocks[id].pack === showcase.pack);
    const pieces = piecesOf(catalogue, showcase.pack);
    const prefabs = {};
    const objects = pieces.filter(({ id }) => context.objects[id]).map(({ id }) => objectItem(id, context.objects[id]));
    const samples = blocks.map((id) => prefabItem("showcase.small." + id, sample(prefabs, "showcase.small." + id, id, [2, 2, 1])));
    const inside = layout([...samples, ...objects], 0, 0, ROOM_WIDTH);
    const across = evenCubes(Math.max(inside.width, 4) + 2 * GAP);
    const deep = evenCubes(inside.depth + 2 * GAP);
    const room = { x: snap(showcase.x + across / 2 + CUBE), z: snap(showcase.z + deep / 2 + CUBE) };
    const props = [{ prefab: "showcase.room", x: room.x, z: room.z, angle: 0 }];

    prefabs["showcase.room"] = roomPrefab(across, deep);
    props.push(...layout([...samples, ...objects], room.x - across / 2 + GAP, room.z - deep / 2 + GAP, ROOM_WIDTH).props);

    if(context.objects[LAMP])
    {
        const [width, , depth] = context.objects[LAMP].cells;
        const [dx, dz] = [across / 2 - width * CUBE / 2, deep / 2 - depth * CUBE / 2];

        for(const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { props.push({ object: LAMP, x: room.x + sx * dx, z: room.z + sz * dz, angle: 0 }); }
    }

    let top = room.z + deep / 2 + CUBE + 2 * GAP;
    const walls = blocks.map((id) => prefabItem("showcase." + id, sample(prefabs, "showcase." + id, id, [4, 6, 1])));
    const rows = [walls, ...catalogue.pieceTypes.map(([type]) => pieces.filter((piece) => piece.type === type).map((piece) => itemOf(piece.id, context)))];

    for(const items of rows.filter((row) => row.length > 0))
    {
        const placed = layout(items, showcase.x, top, WIDTH);

        props.push(...placed.props);
        top += placed.depth + 2 * GAP;
    }

    return { props, prefabs };
}

// Each base id once, as a prefab variant such as `pine.3` shares its entry.
function piecesOf(catalogue, pack)
{
    const seen = new Set();
    const pieces = [];

    for(const [id, entry] of Object.entries(catalogue.pieces))
    {
        const base = id.split(".")[0];

        if(entry.pack !== pack || seen.has(base)) { continue; }

        seen.add(base);
        pieces.push({ id, type: entry.type });
    }

    return pieces;
}

function itemOf(id, context)
{
    if(context.objects[id]) { return objectItem(id, context.objects[id]); }

    return prefabItem(id, context.prefabs[id]);
}

// An item is `across` by `deep` metres, and `place(left, top)` gives the
// placement whose footprint starts at that corner.
function objectItem(id, object)
{
    const [width, , depth] = object.cells;
    const [across, deep] = [width * CUBE, depth * CUBE];

    return { across, deep, place: (left, top) => ({ object: id, x: snap(left) + across / 2, z: snap(top) + deep / 2, angle: 0 }) };
}

function prefabItem(id, prefab)
{
    const low = [Infinity, Infinity];
    const high = [-Infinity, -Infinity];

    for(const { at, size } of prefab.blocks)
    {
        for(const [i, axis] of [0, 2].entries())
        {
            low[i] = Math.min(low[i], at[axis] - size[axis] / 2);
            high[i] = Math.max(high[i], at[axis] + size[axis] / 2);
        }
    }

    return { across: high[0] - low[0], deep: high[1] - low[1], place: (left, top) => ({ prefab: id, x: snap(left - low[0]), z: snap(top - low[1]), angle: 0 }) };
}

function layout(items, left, top, width)
{
    const props = [];
    let [x, z, rowDepth, widest] = [0, 0, 0, 0];

    for(const item of items)
    {
        if(x > 0 && x + item.across > width)
        {
            z += rowDepth + GAP;
            [x, rowDepth] = [0, 0];
        }

        props.push(item.place(left + x, top + z));
        widest = Math.max(widest, x + item.across);
        rowDepth = Math.max(rowDepth, item.deep);
        x += item.across + GAP;
    }

    return { props, width: widest, depth: z + rowDepth };
}

// A block of `cubes`, [across, up, deep], standing on its prefab's origin
// with its back face on the origin's row.
function sample(prefabs, id, block, [across, up, deep])
{
    prefabs[id] = { blocks: [box([across * CUBE, up * CUBE, deep * CUBE], [0, up * CUBE / 2, deep * CUBE / 2], block)], colliders: [], lights: [], rooms: [], doors: [], clears: [], objects: [], problems: [] };

    return prefabs[id];
}

// `across` and `deep` are the room's inside, a whole even number of cubes,
// so every wall lies on whole cubes. The doorway faces +z.
function roomPrefab(across, deep)
{
    const [outside, outsideDeep] = [across + 2 * CUBE, deep + 2 * CUBE];
    const [door, doorHeight] = [DOOR[0] * CUBE, DOOR[1] * CUBE];
    const height = STOREY * CUBE;
    const wallY = CUBE + height / 2;
    const side = (outside - door) / 2;
    const front = deep / 2 + CUBE / 2;

    return {
        blocks:
        [
            box([outside, CUBE, outsideDeep], [0, CUBE / 2, 0], ROOM.floor),
            box([outside, height, CUBE], [0, wallY, -front], ROOM.wall),
            box([CUBE, height, deep], [-(across / 2 + CUBE / 2), wallY, 0], ROOM.wall),
            box([CUBE, height, deep], [across / 2 + CUBE / 2, wallY, 0], ROOM.wall),
            box([side, height, CUBE], [-(door / 2 + side / 2), wallY, front], ROOM.wall),
            box([side, height, CUBE], [door / 2 + side / 2, wallY, front], ROOM.wall),
            box([door, height - doorHeight, CUBE], [0, CUBE + doorHeight + (height - doorHeight) / 2, front], ROOM.wall),
            box([outside, CUBE, outsideDeep], [0, CUBE + height + CUBE / 2, 0], ROOM.roof),
        ],
        colliders: [],
        lights: [],
        rooms: [],
        doors: [],
        clears: [],
        objects: [],
        problems: [],
    };
}

function box(size, at, block)
{
    return { size, at, block };
}

function snap(metres)
{
    return Math.round(metres / CUBE) * CUBE;
}

function evenCubes(metres)
{
    return Math.ceil(metres / CUBE / 2) * 2 * CUBE;
}
