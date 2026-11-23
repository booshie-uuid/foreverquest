import * as THREE from "three";

const MAX_STEP = 0.05;

export class Renderer
{
    constructor(container)
    {
        this.container = container;
        this.webgl = new THREE.WebGLRenderer({ antialias: true });
        this.screen = null;
        this.lastTime = 0;
        this.frameCount = 0;

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

    resize()
    {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
