import { Log } from "../log.js";

const DEPTH = 8;

export class ChunkWorkers
{
    constructor(table, count)
    {
        this.workers = [];
        this.outstanding = new Map();
        this.requests = new Map();
        this.nextId = 1;

        for(let i = 0; i < count; i++)
        {
            const worker = new Worker(new URL("./mesh-worker.js", import.meta.url), { type: "module" });

            worker.onmessage = (event) => this.finish(event.data);
            worker.onerror = (event) => this.fail(worker, event);
            worker.postMessage({ type: "table", table });
            this.workers.push(worker);
            this.outstanding.set(worker, 0);
        }
    }

    static forMachine(table)
    {
        return new ChunkWorkers(table, Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 1)));
    }

    get capacity()
    {
        return this.workers.length * DEPTH - this.requests.size;
    }

    get hasIdle()
    {
        return this.capacity > 0;
    }

    mesh(cells, origin, frame)
    {
        const worker = this.workers.reduce((best, each) => (this.outstanding.get(each) < this.outstanding.get(best) ? each : best), this.workers[0]);
        const id = this.nextId++;

        if(!worker || this.outstanding.get(worker) >= DEPTH) { return Promise.reject(new Error("Every mesh worker is busy")); }

        return new Promise((resolve, reject) =>
        {
            this.requests.set(id, { worker, resolve, reject });
            this.outstanding.set(worker, this.outstanding.get(worker) + 1);
            worker.postMessage({ type: "mesh", id, cells, origin, frame }, [cells.buffer]);
        });
    }

    finish({ id, arrays })
    {
        const request = this.requests.get(id);

        if(!request) { return; }

        this.requests.delete(id);
        this.outstanding.set(request.worker, this.outstanding.get(request.worker) - 1);
        request.resolve(arrays);
    }

    fail(worker, event)
    {
        Log.error("A mesh worker failed: " + event.message);

        for(const [id, request] of this.requests)
        {
            if(request.worker !== worker) { continue; }

            this.requests.delete(id);
            request.reject(new Error(event.message));
        }

        this.outstanding.set(worker, 0);
    }

    dispose()
    {
        for(const worker of this.workers) { worker.terminate(); }

        for(const request of this.requests.values()) { request.reject(new Error("The mesh workers were stopped")); }

        this.requests.clear();
    }
}
