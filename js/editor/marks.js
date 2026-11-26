import * as THREE from "three";
import { ZoneData } from "../sim/zone-data.js";

const CUBE = 1 / ZoneData.CUBES_PER_METRE;
const GROW = 0.004;
const COLOURS = { add: "#7fd36b", remove: "#e0604a", replace: "#7fb3d5", select: "#e0b04a", note: "#7fb3d5", ground: "#7fd36b", age: "#e0b04a", sculpt: "#7fb3d5", link: "#7fb3d5" };
const RING_LIFT = 0.08;


/******************************************************************************/
/* MARKS                                                                      */
/******************************************************************************/

export class Marks
{
    constructor(scene, zone)
    {
        this.zone = zone;
        this.group = new THREE.Group();
        this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
        this.ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ fog: false }));
        this.outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: COLOURS.select, depthTest: false, transparent: true, fog: false }));

        this.ring = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ depthTest: false, transparent: true, fog: false }));
        this.links = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLOURS.link, depthTest: false, transparent: true, fog: false }));

        this.outline.renderOrder = 10;
        this.ring.renderOrder = 10;
        this.links.renderOrder = 10;
        this.group.add(this.ghost, this.ghostEdges, this.outline, this.ring, this.links);
        this.group.name = "editor marks";
        this.hideGhost();
        this.hideOutline();
        this.hideRing();
        this.hideLinks();
        scene.add(this.group);
    }

    // `box` is [x0, y0, z0, x1, y1, z1] in cells, both corners inside it.
    place(object, [x0, y0, z0, x1, y1, z1])
    {
        const zone = this.zone;
        const size = [x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1].map((cells) => cells * CUBE + GROW * 2);

        object.scale.set(...size);
        object.position.set((x0 + x1 + 1) / 2 * CUBE - zone.half, (y0 + y1 + 1) / 2 * CUBE - zone.base * CUBE, (z0 + z1 + 1) / 2 * CUBE - zone.half);
        object.visible = true;
    }

    showGhost(box, kind)
    {
        this.ghost.material.color.set(COLOURS[kind]);
        this.ghostEdges.material.color.set(COLOURS[kind]);
        this.place(this.ghost, box);
        this.place(this.ghostEdges, box);
    }

    hideGhost()
    {
        this.ghost.visible = false;
        this.ghostEdges.visible = false;
    }

    showOutline(box)
    {
        this.place(this.outline, box);
    }

    hideOutline()
    {
        this.outline.visible = false;
    }

    // `points` holds [x, surface, z] in cells, the surface being the cell on
    // top of a column.
    showRing(points, kind)
    {
        const zone = this.zone;
        const positions = new Float32Array(points.flatMap(([x, y, z]) => [x * CUBE - zone.half, (y - zone.base) * CUBE + RING_LIFT, z * CUBE - zone.half]));

        this.ring.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        this.ring.geometry.computeBoundingSphere();
        this.ring.material.color.set(COLOURS[kind]);
        this.ring.visible = true;
    }

    hideRing()
    {
        this.ring.visible = false;
    }

    // Draws a line from the middle of `from` to the middle of each of `boxes`,
    // all boxes of cells.
    showLinks(from, boxes)
    {
        const zone = this.zone;
        const middle = ([x0, y0, z0, x1, y1, z1]) => [(x0 + x1 + 1) / 2 * CUBE - zone.half, ((y0 + y1 + 1) / 2 - zone.base) * CUBE, (z0 + z1 + 1) / 2 * CUBE - zone.half];
        const positions = boxes.flatMap((box) => [...middle(from), ...middle(box)]);

        this.links.geometry.dispose();
        this.links.geometry = new THREE.BufferGeometry();
        this.links.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
        this.links.visible = boxes.length > 0;
    }

    hideLinks()
    {
        this.links.visible = false;
    }

    dispose()
    {
        this.group.removeFromParent();

        for(const mark of [this.ghost, this.ghostEdges, this.outline, this.ring, this.links])
        {
            mark.geometry.dispose();
            mark.material.dispose();
        }
    }
}
