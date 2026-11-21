import * as THREE from "three";

const MAX_STEP = 0.05;
const RETRO_WIDTH = 640;

export class Renderer
{
    constructor(container)
    {
        this.container = container;
        this.webgl = new THREE.WebGLRenderer({ antialias: true });
        this.screen = null;
        this.lastTime = 0;
        this.frameCount = 0;
        this.isRetro = false;

        this.webgl.shadowMap.enabled = true;
        this.webgl.shadowMap.type = THREE.PCFShadowMap;
        container.appendChild(this.webgl.domElement);

        window.addEventListener("resize", () => this.resize());
    }

    get canvas()
    {
        return this.webgl.domElement;
    }

    setScreen(screen)
    {
        if(this.screen === screen) { return; }

        this.screen?.hide();
        this.screen = screen;
        screen.show();
        this.resize();
    }

    setRetro(isRetro)
    {
        this.isRetro = isRetro;
        this.canvas.classList.toggle("is-retro", isRetro);
        this.resize();
    }

    resize()
    {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const ratio = this.isRetro ? Math.min(1, RETRO_WIDTH / width) : Math.min(window.devicePixelRatio, 2);

        this.webgl.setPixelRatio(ratio);
        this.webgl.setSize(width, height);
        this.screen?.resize(width, height);
    }

    start()
    {
        this.lastTime = performance.now();
        this.webgl.setAnimationLoop((time) => this.frame(time));
    }

    frame(time)
    {
        const delta = Math.min(MAX_STEP, Math.max(0, (time - this.lastTime) / 1000));

        this.lastTime = time;

        if(!this.screen) { return; }

        this.screen.update(delta);
        this.screen.render(this.webgl);
        this.frameCount++;
    }
}
