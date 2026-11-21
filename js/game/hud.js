import * as Controls from "../ui/controls.js";
import * as THREE from "three";

const MAX_LINES = 60;
const LABEL_RANGE = 32;

export class Hud
{
    constructor(container, graphics, actions)
    {
        this.element = Controls.element("div", "hud");
        this.labels = Controls.element("div", "label-layer");
        this.nameCard = Controls.element("div", "panel hud-name");
        this.chat = Controls.element("div", "panel chat");
        this.plates = new Map();
        this.bubbles = new Map();
        this.runButton = Controls.button("Run: Off", actions.onToggleRun, "button");

        const help = Controls.element("div", "panel hud-help");

        help.innerHTML = "<kbd>Click</kbd> move / talk &nbsp; <kbd>W A S D</kbd> walk<br>"
            + "<kbd>Right-drag</kbd> or <kbd>← →</kbd> camera &nbsp; <kbd>Wheel</kbd> zoom<br>"
            + "<kbd>R</kbd> run &nbsp; <kbd>E</kbd> wave";

        const buttons = Controls.element("div", "hud-actions");
        const appearanceButton = Controls.button("Appearance", actions.onAppearance, "button");

        appearanceButton.dataset.action = "appearance";
        this.runButton.dataset.action = "run";
        const settings = Controls.element("div", "panel hud-settings");

        settings.append(Controls.graphicsToggles(graphics));
        buttons.append(settings, this.runButton, appearanceButton);

        this.element.append(this.labels, this.nameCard, help, this.chat, buttons);
        this.element.hidden = true;
        container.append(this.element);
    }

    show()
    {
        this.element.hidden = false;
    }

    hide()
    {
        this.element.hidden = true;
    }

    setPlayer(appearance)
    {
        const name = Controls.element("strong", "", appearance.get("name"));
        const detail = Controls.element("span", "", appearance.variant.name + " " + appearance.body.name);

        this.nameCard.replaceChildren(name, detail);
    }

    setRunning(isRunning)
    {
        this.runButton.textContent = isRunning ? "Run: On" : "Run: Off";
    }

    /* CHAT *******************************************************************/

    system(text)
    {
        this.addLine(Controls.element("div", "chat-line system", text));
    }

    say(name, text)
    {
        const line = Controls.element("div", "chat-line say");

        line.append(Controls.element("b", "", name + ": "), document.createTextNode(text));
        this.addLine(line);
    }

    addLine(line)
    {
        this.chat.append(line);

        while(this.chat.children.length > MAX_LINES) { this.chat.firstChild.remove(); }

        this.chat.scrollTop = this.chat.scrollHeight;
    }

    bubble(actor, text, seconds = 4)
    {
        this.bubbles.get(actor)?.node.remove();

        const node = Controls.element("div", "bubble", text);

        this.labels.append(node);
        this.bubbles.set(actor, { node, time: seconds });
    }

    marker(x, y)
    {
        const node = Controls.element("div", "click-marker");

        node.style.left = x + "px";
        node.style.top = y + "px";
        node.addEventListener("animationend", () => node.remove());
        this.labels.append(node);
    }

    /* LABELS *****************************************************************/

    update(delta, camera, actors, player, size)
    {
        const point = new THREE.Vector3();

        for(const actor of actors)
        {
            const plate = this.plateFor(actor, actor === player);
            const height = actor.model.plan.height + actor.measures.nameplate;

            point.set(actor.position.x, actor.position.y + height, actor.position.z);

            const isNear = camera.position.distanceTo(point) < LABEL_RANGE;
            const isVisible = this.project(point, camera, size) && isNear;

            plate.hidden = !isVisible || this.bubbles.has(actor);
            plate.style.left = point.x + "px";
            plate.style.top = point.y + "px";

            this.updateBubble(delta, actor, point, isVisible);
        }
    }

    updateBubble(delta, actor, point, isVisible)
    {
        const bubble = this.bubbles.get(actor);

        if(!bubble) { return; }

        bubble.time -= delta;

        if(bubble.time <= 0)
        {
            bubble.node.remove();
            this.bubbles.delete(actor);

            return;
        }

        bubble.node.hidden = !isVisible;
        bubble.node.style.left = point.x + "px";
        bubble.node.style.top = point.y + "px";
    }

    plateFor(actor, isPlayer)
    {
        let plate = this.plates.get(actor);

        if(!plate)
        {
            plate = Controls.element("div", isPlayer ? "nameplate is-player" : "nameplate");
            this.labels.append(plate);
            this.plates.set(actor, plate);
        }

        if(plate.textContent !== actor.name) { plate.textContent = actor.name; }

        return plate;
    }

    project(point, camera, size)
    {
        point.project(camera);

        if(point.z > 1) { return false; }

        point.x = (point.x * 0.5 + 0.5) * size.width;
        point.y = (-point.y * 0.5 + 0.5) * size.height;

        return true;
    }
}
