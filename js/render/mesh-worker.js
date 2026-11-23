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

    const arrays = CubeMesher.meshCells(message.cells, table, message.origin, message.frame);
    const buffers = arrays ? Object.values(arrays).map((array) => array.buffer) : [];

    self.postMessage({ id: message.id, arrays }, buffers);
};
