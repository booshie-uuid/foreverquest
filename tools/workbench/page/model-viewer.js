import * as Catalogue from "../../../js/character/catalogue.js";
import * as Controls from "../../../js/ui/controls.js";
import * as Fitter from "../../../js/kit/fitter.js";
import * as THREE from "three";
import { Animator } from "../../../js/character/animator.js";
import { Appearance } from "../../../js/character/appearance.js";
import { CharacterModel } from "../../../js/character/character-model.js";
import { Random } from "../../../js/util/random.js";

const PANEL_WIDTH = 352;
const OVERLAY_COLOUR = "#e0b060";
const JOINT_SIZE = 0.035;
const COMPARE_GAP = 0.6;

const MOTIONS =
[
    { id: "idle", name: "Idle", speed: 0 },
    { id: "walk", name: "Walk", speed: Animator.WALK_SPEED },
    { id: "run", name: "Run", speed: Animator.RUN_SPEED },
];

const GEAR =
[
    { id: "default", name: "Default" },
    { id: "random", name: "Random" },
    { id: "bare", name: "None" },
    { id: "spikeA", name: "Spike A" },
    { id: "spikeB", name: "Spike B" },
];

const SPIKES =
{
    spikeA: { head: "none", chest: "tunic", legs: "none", feet: "none", hands: "none", back: "none", mainHand: "sword", offHand: "lantern" },
    spikeB: { head: "helm", chest: "plate", legs: "none", feet: "none", hands: "none", back: "cloak", mainHand: "sword", offHand: "none" },
};


/******************************************************************************/
/* MODEL VIEWER                                                               */
/******************************************************************************/

export class ModelViewer
{
    constructor(container, canvas, library, state, onStateChange)
    {
        this.canvas = canvas;
        this.library = library;
        this.state = state;
        this.onStateChange = onStateChange;
        this.size = { width: 1, height: 1 };
        this.drag = null;
        this.overlay = [];

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
        this.appearance = new Appearance(library);
        this.model = new CharacterModel(this.appearance);
        this.animator = new Animator(this.model);
        this.partsModel = new CharacterModel(this.appearance, { pipeline: "parts" });
        this.partsAnimator = new Animator(this.partsModel);

        this.buildScene();
        this.panel = Controls.element("aside", "panel workbench-panel");
        this.stats = Controls.element("div", "panel workbench-stats");
        container.append(this.panel, this.stats);

        this.model.onChange(() => this.onModelChange());
        this.applyState();
        this.attachPointer();
    }

    buildScene()
    {
        const key = new THREE.DirectionalLight("#dfe4ee", 2.2);

        this.scene.background = new THREE.Color("#1a1c21");
        this.scene.add(new THREE.HemisphereLight("#9aa4b8", "#2a2620", 1.8));
        key.position.set(2, 4, 3);
        this.scene.add(key);
        this.scene.add(new THREE.GridHelper(6, 24, "#4a4e58", "#2c2f36"));
        this.scene.add(this.model.root);
    }

    /* STATE ******************************************************************/

    setState(changes)
    {
        this.state = { ...this.state, ...changes };
        this.applyState();
        this.onStateChange(this.state);
    }

    applyState()
    {
        const state = this.state;
        const body = this.library.body(state.body) ?? this.library.allBodies[0];
        const variant = body.variants.some((entry) => entry.id === state.variant) ? state.variant : body.variants[0].id;
        const choice = { body: body.id, variant };
        const data = state.gear === "random" ? Appearance.randomData(this.library, new Random(state.seed), choice) : { ...choice };

        data.height = state.height;
        data.build = state.build;

        if(body.skins.includes(state.skin)) { data.skin = state.skin; }
        if(state.gear === "bare") { data.equipment = Object.fromEntries(Catalogue.SLOTS.map((slot) => [slot.id, { item: "none" }])); }

        if(SPIKES[state.gear])
        {
            Object.assign(data, { face: "1", hair: "long", beard: "none", markings: "none" });
            data.equipment = Object.fromEntries(Object.entries(SPIKES[state.gear]).map(([slot, item]) => [slot, { item }]));
        }

        this.state = { ...state, body: body.id, variant };
        this.appearance.replace(data);
        this.renderPanel();
    }

    /* PANEL ******************************************************************/

    renderPanel()
    {
        const state = this.state;
        const body = this.appearance.body;
        const isBiped = this.model.plan.rig.motion === "biped";
        const bodies = this.library.allBodies;
        const step = (list, current, direction) => list[(list.findIndex((entry) => entry.id === current) + direction + list.length) % list.length].id;

        const rows =
        [
            Controls.element("h1", "", "Model Viewer"),
            Controls.element("h2", "", "Body"),
            Controls.stepper("Body", body.name + (body.playable ? "" : " (creature)"), (direction) => this.setState({ body: step(bodies, body.id, direction) }), "body"),
            Controls.stepper("Variant", this.appearance.variant.name, (direction) => this.setState({ variant: step(body.variants, state.variant, direction) }), "variant"),
            Controls.slider("Height", state.height, (value) => this.setState({ height: value }), "height"),
            Controls.slider("Build", state.build, (value) => this.setState({ build: value }), "build"),
            Controls.swatches("Skin", body.skins, this.appearance.get("skin"), (colour) => this.setState({ skin: colour }), "skin"),
        ];

        if(body.surface === "outfit")
        {
            rows.push(Controls.element("h2", "", "Gear"));
            rows.push(this.toggles(GEAR, state.gear, (id) => this.setState({ gear: id, seed: id === "random" ? state.seed + 1 : state.seed }), "gear"));
        }

        rows.push(Controls.element("h2", "", "View"));

        if(isBiped) { rows.push(this.toggles(MOTIONS, state.motion, (id) => this.setState({ motion: id }), "motion")); }

        rows.push(this.toggles([{ id: "bones", name: "Bones and boxes" }], state.overlay ? "bones" : null, () => this.setState({ overlay: !state.overlay }), "overlay"));

        if(body.surface === "outfit") { rows.push(this.toggles([{ id: "compare", name: "Compare with parts" }], state.compare ? "compare" : null, () => this.setState({ compare: !state.compare }), "compare")); }

        if(isBiped) { rows.push(Controls.button("Wave", () => this.wave(), "button")); }

        this.panel.replaceChildren(...rows);
    }

    toggles(options, selected, onPick, key)
    {
        const group = Controls.element("div", "toggle-group");

        group.dataset.key = key;

        for(const option of options)
        {
            const node = Controls.button(option.name, () => onPick(option.id), "toggle");

            node.dataset.option = option.id;
            node.classList.toggle("is-active", option.id === selected);
            group.append(node);
        }

        return group;
    }

    /* MODEL ******************************************************************/

    onModelChange()
    {
        this.clearOverlay();

        if(this.state.overlay) { this.buildOverlay(); }

        const plan = this.model.plan;
        const sheet = this.model.textures.map.image;

        this.stats.textContent = (this.isComparing ? "Left: prototype · Right: baked parts · " : "") + plan.rig.id + " · " + plan.fit.bones.length + " bones · " + this.model.triangleCount + " triangles · sheet " + sheet.width + " × " + sheet.height + " · " + plan.height.toFixed(2) + " m";
    }

    buildOverlay()
    {
        const material = new THREE.LineBasicMaterial({ color: OVERLAY_COLOUR, depthTest: false, transparent: true });
        const marker = new THREE.MeshBasicMaterial({ color: OVERLAY_COLOUR, depthTest: false, transparent: true });

        for(const bone of this.model.plan.fit.bones)
        {
            const joint = this.model.joints[bone.name];
            const point = new THREE.Mesh(new THREE.BoxGeometry(JOINT_SIZE, JOINT_SIZE, JOINT_SIZE), marker);

            this.addOverlay(joint, point);

            if(!bone.size) { continue; }

            const box = new THREE.BoxGeometry(...bone.size.map((value) => value * Fitter.TEXEL));
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), material);

            box.dispose();
            edges.position.set(...bone.centre.map((value) => value * Fitter.TEXEL));
            this.addOverlay(joint, edges);
        }
    }

    wave()
    {
        this.animator.wave();
        this.partsAnimator.wave();
    }

    addOverlay(parent, object)
    {
        object.renderOrder = 10;
        parent.add(object);
        this.overlay.push(object);
    }

    clearOverlay()
    {
        for(const object of this.overlay)
        {
            object.removeFromParent();
            object.geometry.dispose();
            object.material.dispose();
        }

        this.overlay = [];
    }

    /* SCREEN *****************************************************************/

    attachPointer()
    {
        this.canvas.addEventListener("pointerdown", (event) =>
        {
            this.drag = { x: event.clientX };
            this.canvas.setPointerCapture?.(event.pointerId);
        });

        this.canvas.addEventListener("pointermove", (event) =>
        {
            if(!this.drag) { return; }

            this.state.yaw += (event.clientX - this.drag.x) * 0.012;
            this.drag.x = event.clientX;
        });

        this.canvas.addEventListener("pointerup", () =>
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

    get isComparing()
    {
        return this.state.compare && this.appearance.body.surface === "outfit";
    }

    show() {}

    hide() {}

    resize(width, height)
    {
        this.size = { width, height };
        this.camera.aspect = width / height;
        this.camera.setViewOffset(width, height, -PANEL_WIDTH / 2, 0, width, height);
        this.camera.updateProjectionMatrix();
    }

    update(delta)
    {
        const plan = this.model.plan;
        const speed = MOTIONS.find((motion) => motion.id === this.state.motion)?.speed ?? 0;
        const extent = Math.max(plan.height, plan.fit.bones.reduce((widest, bone) => Math.max(widest, ...(bone.size ?? [0])), 0) * Fitter.TEXEL);
        const distance = (extent * (this.isComparing ? 3.6 : 2.6) + 0.8) * this.state.zoom;
        const gap = this.isComparing ? COMPARE_GAP : 0;

        this.animator.update(delta, speed);
        this.model.root.rotation.y = this.state.yaw;
        this.model.root.position.x = -gap;

        if(this.isComparing !== Boolean(this.partsModel.root.parent)) { this.togglePartsModel(); }

        this.partsAnimator.update(delta, speed);
        this.partsModel.root.rotation.y = this.state.yaw;
        this.partsModel.root.position.x = gap;
        this.camera.position.set(0, plan.height * 0.5 + distance * 0.18, distance);
        this.camera.lookAt(0, plan.height * 0.5, 0);
    }

    togglePartsModel()
    {
        if(this.partsModel.root.parent) { this.partsModel.root.removeFromParent(); }
        else { this.scene.add(this.partsModel.root); }
    }

    render(webgl)
    {
        webgl.render(this.scene, this.camera);
    }
}
