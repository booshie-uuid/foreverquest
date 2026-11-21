import * as Controls from "../../../js/ui/controls.js";
import * as PropMesher from "../../../js/render/prop-mesher.js";
import * as THREE from "three";
import { BlockBuilder } from "../../../js/geometry/block-builder.js";

const PANEL_WIDTH = 352;
const OVERLAY_COLOUR = "#e0b060";
const LIGHT_COLOUR = "#ffb060";


/******************************************************************************/
/* PROP VIEWER                                                                */
/******************************************************************************/

export class PropViewer
{
    constructor(container, canvas, materials, prefabs, state, onStateChange)
    {
        this.canvas = canvas;
        this.materials = materials;
        this.prefabs = prefabs;
        this.ids = Object.keys(prefabs).sort();
        this.state = state;
        this.onStateChange = onStateChange;
        this.drag = null;
        this.mesh = null;
        this.overlay = new THREE.Group();

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
        this.scene.background = new THREE.Color("#1a1c21");
        this.scene.add(new THREE.HemisphereLight("#9aa4b8", "#2a2620", 2.2));
        this.scene.add(new THREE.GridHelper(24, 24, "#4a4e58", "#2c2f36"), this.overlay);

        const key = new THREE.DirectionalLight("#dfe4ee", 2);

        key.position.set(4, 8, 6);
        this.scene.add(key);

        this.panel = Controls.element("aside", "panel workbench-panel");
        this.stats = Controls.element("div", "panel workbench-stats");
        container.append(this.panel, this.stats);

        this.applyState();
        this.attachPointer();
    }

    get prefabId()
    {
        return this.prefabs[this.state.prefab] ? this.state.prefab : this.ids[0];
    }

    setState(changes)
    {
        this.state = { ...this.state, ...changes };
        this.applyState();
        this.onStateChange(this.state);
    }

    applyState()
    {
        const prefab = this.prefabs[this.prefabId];
        const builder = new BlockBuilder();

        this.mesh?.geometry.dispose();
        this.mesh?.removeFromParent();
        PropMesher.addPrefab(builder, this.materials.atlas, prefab, { x: 0, y: 0, z: 0, angle: 0, scale: 1 });

        this.mesh = new THREE.Mesh(builder.build(), this.materials.world);
        this.scene.add(this.mesh);
        this.buildOverlay(prefab);
        this.mesh.geometry.computeBoundingSphere();
        this.radius = Math.max(1, this.mesh.geometry.boundingSphere.radius);
        this.stats.textContent = this.prefabId + " · " + prefab.blocks.length + " blocks · " + builder.triangleCount + " triangles · " + prefab.colliders.length + " colliders · " + prefab.lights.length + " lights";
        this.renderPanel();
    }

    buildOverlay(prefab)
    {
        for(const child of [...this.overlay.children])
        {
            child.geometry.dispose();
            child.removeFromParent();
        }

        if(!this.state.overlay) { return; }

        const line = new THREE.LineBasicMaterial({ color: OVERLAY_COLOUR, depthTest: false });

        for(const collider of prefab.colliders)
        {
            const shape = collider.radius !== undefined
                ? new THREE.EdgesGeometry(new THREE.CylinderGeometry(collider.radius, collider.radius, 0.05, 24))
                : new THREE.EdgesGeometry(new THREE.BoxGeometry(collider.halfWidth * 2, 0.05, collider.halfDepth * 2));
            const outline = new THREE.LineSegments(shape, line);

            outline.position.set(collider.x, 0.03, collider.z);
            outline.rotation.y = collider.angle ?? 0;
            this.overlay.add(outline);
        }

        for(const light of prefab.lights)
        {
            const marker = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: LIGHT_COLOUR, depthTest: false }));

            marker.position.set(...light);
            this.overlay.add(marker);
        }

        for(const child of this.overlay.children) { child.renderOrder = 10; }
    }

    renderPanel()
    {
        const step = (direction) => this.ids[(this.ids.indexOf(this.prefabId) + direction + this.ids.length) % this.ids.length];
        const toggle = Controls.button("Colliders and lights", () => this.setState({ overlay: !this.state.overlay }), "toggle");

        toggle.classList.toggle("is-active", this.state.overlay);
        toggle.dataset.key = "overlay";

        this.panel.replaceChildren(
            Controls.element("h1", "", "Prop Viewer"),
            Controls.stepper("Prefab", this.prefabId, (direction) => this.setState({ prefab: step(direction) }), "prefab"),
            Controls.element("h2", "", "View"),
            toggle,
        );
    }

    /* SCREEN *****************************************************************/

    attachPointer()
    {
        this.canvas.addEventListener("pointerdown", (event) =>
        {
            this.drag = { x: event.clientX };
        });

        this.canvas.addEventListener("pointermove", (event) =>
        {
            if(!this.drag) { return; }

            this.state.yaw += (event.clientX - this.drag.x) * 0.012;
            this.drag.x = event.clientX;
        });

        window.addEventListener("pointerup", () =>
        {
            if(this.drag) { this.onStateChange(this.state); }

            this.drag = null;
        });

        this.canvas.addEventListener("wheel", (event) =>
        {
            event.preventDefault();
            this.setState({ zoom: Math.min(3, Math.max(0.3, this.state.zoom * (event.deltaY > 0 ? 1.1 : 0.9))) });
        }, { passive: false });
    }

    show() {}

    hide() {}

    resize(width, height)
    {
        this.camera.aspect = width / height;
        this.camera.setViewOffset(width, height, -PANEL_WIDTH / 2, 0, width, height);
        this.camera.updateProjectionMatrix();
    }

    update()
    {
        const distance = this.radius * 2.8 * this.state.zoom;
        const centre = this.mesh.geometry.boundingSphere.center;

        this.mesh.rotation.y = this.state.yaw;
        this.overlay.rotation.y = this.state.yaw;
        this.camera.position.set(Math.sin(0.2) * distance, centre.y + distance * 0.45, distance);
        this.camera.lookAt(0, centre.y, 0);
    }

    render(webgl)
    {
        webgl.render(this.scene, this.camera);
    }
}
