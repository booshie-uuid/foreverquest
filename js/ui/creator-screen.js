import * as Controls from "./controls.js";
import * as Props from "../world/props.js";
import * as THREE from "three";
import { Animator } from "../character/animator.js";
import { Appearance } from "../character/appearance.js";
import { CharacterModel } from "../character/character-model.js";
import { PropBuilder } from "../world/prop-builder.js";
import { Random } from "../util/random.js";

const PANEL_WIDTH = 380;
const NARROW_WIDTH = 760;

const TABS =
[
    { id: "body", name: "Body" },
    { id: "head", name: "Head" },
    { id: "gear", name: "Gear" },
];

const POSES =
[
    { id: "idle", name: "Idle", speed: 0 },
    { id: "walk", name: "Walk", speed: Animator.WALK_SPEED },
    { id: "run", name: "Run", speed: Animator.RUN_SPEED },
];


/******************************************************************************/
/* CREATOR SCREEN                                                             */
/******************************************************************************/

export class CreatorScreen
{
    constructor(container, library, materials, graphics, onConfirm, onCancel)
    {
        this.library = library;
        this.materials = materials;
        this.graphics = graphics;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
        this.draft = new Appearance(library);
        this.mode = "create";
        this.tab = "body";
        this.pose = "idle";
        this.view = "body";
        this.yaw = 0.4;
        this.drag = null;
        this.size = { width: 1, height: 1 };

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
        this.cameraTarget = new THREE.Vector3();
        this.model = new CharacterModel(this.draft);
        this.animator = new Animator(this.model);

        this.buildScene();
        this.element = this.buildDom();
        container.append(this.element);

        this.draft.onChange((look, key) => this.onDraftChange(key));
        this.model.onChange(() => this.updateStats());
        this.renderTab();
        this.updateStats();
        this.hide();
    }

    open(appearance, mode)
    {
        this.mode = mode;
        this.draft.replace(appearance.toJSON());
        this.confirmButton.textContent = mode === "edit" ? "Save Changes" : "Enter World";
        this.cancelButton.hidden = mode !== "edit";
    }

    /* SCENE ******************************************************************/

    buildScene()
    {
        const scene = this.scene;
        const moon = new THREE.DirectionalLight("#c4d0e6", 2.4);
        const fire = new THREE.PointLight("#ff9a40", 6, 6, 1.4);

        scene.background = new THREE.Color("#141518");
        scene.fog = new THREE.Fog("#141518", 7, 14);
        scene.add(new THREE.HemisphereLight("#8a94a8", "#2a2218", 1.9));

        moon.position.set(2.5, 5, 3.5);
        moon.castShadow = true;
        moon.shadow.mapSize.set(1024, 1024);
        moon.shadow.camera.left = -2;
        moon.shadow.camera.right = 2;
        moon.shadow.camera.top = 3;
        moon.shadow.camera.bottom = -1;
        moon.shadow.bias = -0.0006;
        scene.add(moon);

        fire.position.set(-1.8, 1.2, 1.4);
        scene.add(fire);

        scene.add(this.buildPedestal());
        scene.add(this.model.root);
    }

    buildPedestal()
    {
        const builder = new PropBuilder(this.materials.atlas);

        for(let x = -3; x < 3; x++)
        {
            for(let z = -2; z < 2; z++)
            {
                const isEdge = Math.abs(x + 0.5) > 1.5 || Math.abs(z + 0.5) > 1;

                Props.block(builder, [1, 0.5, 1], [x + 0.5, isEdge ? -0.3 : -0.25, z + 0.5], { top: isEdge ? "mud" : "cobble", all: "earth" });
            }
        }

        Props.block(builder, [0.6, 0.85, 0.6], [-2.4, 0.425, -1.5], { top: "oldPlanks", all: "planks" });
        Props.block(builder, [0.55, 0.55, 0.55], [2.5, 0.275, -1.6], "oldPlanks", [0, 0.4, 0]);

        const mesh = new THREE.Mesh(builder.build(), this.materials.world);

        mesh.receiveShadow = true;
        mesh.castShadow = true;

        return mesh;
    }

    /* DOM ********************************************************************/

    buildDom()
    {
        const root = Controls.element("div", "creator");
        const panel = Controls.element("aside", "panel creator-panel");
        const tabs = Controls.element("nav", "tabs");

        panel.append(Controls.element("h1", "title", "ForeverQuest"), Controls.element("p", "subtitle", "Shape your hero"));

        this.tabButtons = TABS.map((tab) =>
        {
            const node = Controls.button(tab.name, () => this.selectTab(tab.id), "tab");

            node.dataset.tab = tab.id;
            tabs.append(node);

            return node;
        });

        this.tabBody = Controls.element("div", "tab-body");
        this.confirmButton = Controls.button("Enter World", () => this.onConfirm(this.draft), "button primary");
        this.cancelButton = Controls.button("Cancel", () => this.onCancel(), "button");
        this.confirmButton.dataset.action = "confirm";

        const actions = Controls.element("div", "creator-actions");
        const randomButton = Controls.button("Randomise", () => this.randomise(), "button");

        randomButton.dataset.action = "randomise";
        actions.append(randomButton, this.cancelButton, this.confirmButton);
        panel.append(tabs, this.tabBody, actions);
        root.append(panel, this.buildPreviewBar());

        return root;
    }

    buildPreviewBar()
    {
        const bar = Controls.element("div", "panel preview-bar");
        const poses = Controls.element("div", "toggle-group");
        const views = Controls.element("div", "toggle-group");

        this.poseButtons = POSES.map((pose) => this.toggleButton(poses, pose.name, () => this.setPose(pose.id), pose.id === this.pose));
        poses.append(Controls.button("Wave", () => this.animator.wave(), "toggle"));

        this.viewButtons =
        [
            this.toggleButton(views, "Body", () => this.setView("body"), true),
            this.toggleButton(views, "Face", () => this.setView("face"), false),
        ];

        this.stats = Controls.element("span", "stats");
        bar.append(poses, views, Controls.graphicsToggles(this.graphics), this.stats);

        return bar;
    }

    toggleButton(group, text, onClick, isActive)
    {
        const node = Controls.button(text, onClick, "toggle");

        node.classList.toggle("is-active", isActive);
        group.append(node);

        return node;
    }

    selectTab(tabId)
    {
        this.tab = tabId;
        this.renderTab();
    }

    renderTab()
    {
        for(const node of this.tabButtons) { node.classList.toggle("is-active", node.dataset.tab === this.tab); }

        const rows = this.tab === "body" ? this.bodyRows() : this.tab === "head" ? this.headRows() : this.gearRows();

        this.tabBody.replaceChildren(...rows);
    }

    bodyRows()
    {
        const look = this.draft;

        return [
            Controls.textInput("Name", look.get("name"), (value, input) => this.rename(value, input), "name"),
            this.optionStepper("Race", "body"),
            this.optionStepper("Body", "variant"),
            Controls.slider("Height", look.get("height"), (value) => look.set("height", value), "height"),
            Controls.slider("Build", look.get("build"), (value) => look.set("build", value), "build"),
            Controls.swatches("Skin", look.choices("skin"), look.get("skin"), (colour) => look.set("skin", colour), "skin"),
        ];
    }

    headRows()
    {
        const look = this.draft;

        return [
            this.optionStepper("Face", "face"),
            this.optionStepper("Nose", "nose"),
            Controls.swatches("Eyes", look.choices("eyes"), look.get("eyes"), (colour) => look.set("eyes", colour), "eyes"),
            this.optionStepper("Hair", "hair"),
            Controls.swatches("Hair Colour", look.choices("hairColour"), look.get("hairColour"), (colour) => look.set("hairColour", colour), "hairColour"),
            this.optionStepper("Beard", "beard"),
            this.optionStepper("Markings", "markings"),
        ];
    }

    gearRows()
    {
        const rows = [];

        for(const slot of this.draft.gearSlots)
        {
            const gear = this.draft.equipped(slot.id);
            const item = this.library.part(slot.id, gear.item);
            const group = Controls.element("div", "gear-slot");

            group.append(Controls.stepper(slot.name, item.name, (direction) => this.cycleItem(slot.id, direction), "slot-" + slot.id));

            if(item.tints.primary)
            {
                const colours = Appearance.tintChoices(this.library, slot.id, item.id, "primary");

                group.append(Controls.swatches("Colour", colours, gear.colour, (colour) => this.draft.tint(slot.id, "primary", colour), "tint-" + slot.id));
            }

            if(item.tints.trim)
            {
                const trims = Appearance.tintChoices(this.library, slot.id, item.id, "trim");

                group.append(Controls.swatches("Trim", trims, gear.trim, (colour) => this.draft.tint(slot.id, "trim", colour), "trim-" + slot.id));
            }

            rows.push(group);
        }

        return rows;
    }

    optionStepper(label, key)
    {
        const option = this.optionsFor(key).find((entry) => entry.id === this.draft.get(key));
        const text = key === "face" ? option.id + " · " + option.name : option.name;

        return Controls.stepper(label, text, (direction) => this.cycle(key, direction), key);
    }

    optionsFor(key)
    {
        if(key === "body") { return this.library.playableBodies; }
        if(key === "variant") { return this.draft.body.variants; }

        return this.library.partsFor(key);
    }

    /* CHANGES ****************************************************************/

    cycle(key, direction)
    {
        const choices = this.draft.choices(key);
        const index = choices.indexOf(this.draft.get(key));

        this.draft.set(key, choices[(index + direction + choices.length) % choices.length]);
    }

    cycleItem(slot, direction)
    {
        const items = this.library.partsFor(slot);
        const index = items.findIndex((item) => item.id === this.draft.equipped(slot).item);

        this.draft.equip(slot, items[(index + direction + items.length) % items.length].id);
    }

    rename(value, input)
    {
        const isValid = Appearance.isValid(this.library, "name", value, this.draft.get("body"));

        input.classList.toggle("is-invalid", !isValid);
        this.confirmButton.disabled = !isValid;

        if(isValid) { this.draft.set("name", value); }
    }

    randomise()
    {
        const random = new Random(Date.now());

        this.draft.replace({ ...Appearance.randomData(this.library, random), name: this.draft.get("name") });
    }

    onDraftChange(key)
    {
        if(key === "name" || key === "height" || key === "build") { return; }

        this.renderTab();
    }

    setPose(poseId)
    {
        this.pose = poseId;
        this.poseButtons.forEach((node, i) => node.classList.toggle("is-active", POSES[i].id === poseId));
    }

    setView(viewId)
    {
        this.view = viewId;
        this.viewButtons[0].classList.toggle("is-active", viewId === "body");
        this.viewButtons[1].classList.toggle("is-active", viewId === "face");
    }

    updateStats()
    {
        this.stats.textContent = this.model.triangleCount.toLocaleString("en-GB") + " triangles";
    }

    /* SCREEN *****************************************************************/

    show()
    {
        this.element.hidden = false;
        this.attachPointer();
    }

    hide()
    {
        this.element.hidden = true;
        this.detachPointer?.();
    }

    attachPointer()
    {
        const canvas = this.element.parentElement.querySelector("canvas");
        const down = (event) =>
        {
            this.drag = { x: event.clientX };
            canvas.setPointerCapture?.(event.pointerId);
        };
        const move = (event) =>
        {
            if(!this.drag) { return; }

            this.yaw += (event.clientX - this.drag.x) * 0.012;
            this.drag.x = event.clientX;
        };
        const up = () =>
        {
            this.drag = null;
        };

        canvas.addEventListener("pointerdown", down);
        canvas.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);

        this.detachPointer = () =>
        {
            canvas.removeEventListener("pointerdown", down);
            canvas.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            this.detachPointer = null;
        };
    }

    resize(width, height)
    {
        this.size = { width, height };
        this.camera.aspect = width / height;

        if(width >= NARROW_WIDTH)
        {
            this.camera.setViewOffset(width, height, -PANEL_WIDTH / 2, 0, width, height);
        }
        else
        {
            this.camera.setViewOffset(width, height, 0, height * 0.22, width, height);
        }

        this.camera.updateProjectionMatrix();
    }

    update(delta)
    {
        const speed = POSES.find((pose) => pose.id === this.pose).speed;
        const plan = this.model.plan;
        const isFace = this.view === "face";
        const headY = plan.height - plan.headHeight * 0.5;
        const targetY = isFace ? headY : plan.height * 0.5;
        const distance = isFace ? plan.headHeight * 6 : plan.height * 2.6 + 1.2;
        const ease = Math.min(1, delta * 6);

        this.animator.update(delta, speed);
        this.model.root.rotation.y = this.yaw;

        this.cameraTarget.y += (targetY - this.cameraTarget.y) * ease;
        this.camera.position.lerp(new THREE.Vector3(0, targetY + distance * 0.12, distance), ease);
        this.camera.lookAt(this.cameraTarget);
    }

    render(webgl)
    {
        webgl.render(this.scene, this.camera);
    }
}
