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
    const buffers = [arrays.floors.indices.buffer, arrays.floors.levels.buffer, ...Object.entries(arrays).filter(([name]) => name !== "floors").map(([, array]) => array.buffer)];

    self.postMessage({ id: message.id, arrays }, buffers);
};
