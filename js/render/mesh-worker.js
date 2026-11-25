import * as CubeMesher from "./cube-mesher.js";

let table = null;

self.onmessage = (event) =>
{
    const message = event.data;

    if(message.type === "table")
    {
        table = message.table;
        return;
    }

    const arrays = CubeMesher.meshCells(message.volume, table, message.origin, message.frame);
    const { floors, halos, glass = {}, ...faces } = arrays;
    const buffers = [floors.indices, floors.levels, floors.glows, floors.hues, halos, ...Object.values(faces), ...Object.values(glass)].map((array) => array.buffer);

    self.postMessage({ id: message.id, arrays }, buffers);
};
