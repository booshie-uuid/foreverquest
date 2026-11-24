import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as timers from "node:timers/promises";

import { Log } from "../../js/log.js";

const BROWSER_PATHS =
[
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
];

const DEVTOOLS_URL_PATTERN = /DevTools listening on (ws:\/\/\S+)/;
const LAUNCH_TIMEOUT_MS = 30000;
const CLOSE_TIMEOUT_MS = 5000;

// Values for the `buttons` bitmask of Input.dispatchMouseEvent.
const MOUSE_BUTTONS =
{
    left: 1,
    right: 2,
    middle: 4,
};

const NAMED_KEYS =
{
    " ": { code: "Space", keyCode: 32, text: " " },
    ArrowDown: { code: "ArrowDown", keyCode: 40 },
    ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
    ArrowRight: { code: "ArrowRight", keyCode: 39 },
    ArrowUp: { code: "ArrowUp", keyCode: 38 },
    Backspace: { code: "Backspace", keyCode: 8 },
    Enter: { code: "Enter", keyCode: 13, text: "\r" },
    Escape: { code: "Escape", keyCode: 27 },
    F8: { code: "F8", keyCode: 119 },
    Shift: { code: "ShiftLeft", keyCode: 16, location: 1 },
    Tab: { code: "Tab", keyCode: 9 },
};


/******************************************************************************/
/* CONNECTION                                                                 */
/******************************************************************************/

class Connection
{
    constructor(socket)
    {
        this.socket = socket;
        this.nextId = 1;
        this.pending = new Map();
        this.sessions = new Map();
        this.isClosed = false;

        socket.addEventListener("message", (event) => this.receive(event.data));
        socket.addEventListener("close", () => this.close());
    }

    static open(endpoint)
    {
        return new Promise((resolve, reject) =>
        {
            const socket = new WebSocket(endpoint);

            socket.addEventListener("open", () => resolve(new Connection(socket)), { once: true });
            socket.addEventListener("error", () => reject(new Error("Could not connect to " + endpoint)), { once: true });
        });
    }

    send(method, params = {}, sessionId = undefined)
    {
        if(this.isClosed) { return Promise.reject(new Error(method + " failed: the browser connection is closed.")); }

        const id = this.nextId++;

        return new Promise((resolve, reject) =>
        {
            this.pending.set(id, { method, resolve, reject });
            this.socket.send(JSON.stringify({ id, method, params, sessionId }));
        });
    }

    createSession(sessionId)
    {
        const session = new Session(this, sessionId);

        this.sessions.set(sessionId, session);

        return session;
    }

    removeSession(sessionId)
    {
        this.sessions.delete(sessionId);
    }

    receive(data)
    {
        const message = JSON.parse(data);

        if(message.id === undefined)
        {
            this.sessions.get(message.sessionId)?.dispatch(message.method, message.params);
            return;
        }

        const request = this.pending.get(message.id);

        if(!request) { return; }

        this.pending.delete(message.id);

        if(message.error)
        {
            const detail = message.error.data ? " (" + message.error.data + ")" : "";

            request.reject(new Error(request.method + " failed: " + message.error.message + detail));
            return;
        }

        request.resolve(message.result);
    }

    close()
    {
        if(this.isClosed) { return; }

        this.isClosed = true;
        this.socket.close();

        for(const request of this.pending.values())
        {
            request.reject(new Error(request.method + " failed: the browser connection closed."));
        }

        this.pending.clear();
    }
}

/* SESSION ********************************************************************/

class Session
{
    constructor(connection, id)
    {
        this.connection = connection;
        this.id = id;
        this.listeners = new Map();
    }

    send(method, params = {})
    {
        return this.connection.send(method, params, this.id);
    }

    on(method, listener)
    {
        const listeners = this.listeners.get(method) ?? new Set();

        listeners.add(listener);
        this.listeners.set(method, listeners);

        return () => listeners.delete(listener);
    }

    dispatch(method, params)
    {
        for(const listener of this.listeners.get(method) ?? []) { listener(params); }
    }

    waitForEvent(method, timeoutMs)
    {
        const waiter = {};

        waiter.promise = new Promise((resolve, reject) =>
        {
            const removeListener = this.on(method, (params) =>
            {
                waiter.cancel();
                resolve(params);
            });

            const timer = setTimeout(() =>
            {
                waiter.cancel();
                reject(new Error("Timed out after " + timeoutMs + " ms waiting for " + method + "."));
            }, timeoutMs);

            waiter.cancel = () =>
            {
                clearTimeout(timer);
                removeListener();
            };
        });

        return waiter;
    }
}


/******************************************************************************/
/* PAGE                                                                       */
/******************************************************************************/

export class Page
{
    constructor(session, browserContextId)
    {
        this.session = session;
        this.browserContextId = browserContextId;
        this.errors = [];

        session.on("Runtime.exceptionThrown", (params) => this.recordException(params.exceptionDetails));
        session.on("Runtime.consoleAPICalled", (params) => this.recordConsoleCall(params));
        session.on("Log.entryAdded", (params) => this.recordLogEntry(params.entry));
        session.on("Inspector.targetCrashed", () => this.errors.push("The page crashed."));
    }

    async initialise({ width, height })
    {
        await Promise.all(
        [
            this.session.send("Page.enable"),
            this.session.send("Runtime.enable"),
            this.session.send("Log.enable"),
            this.session.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }),
            this.session.send("Emulation.setFocusEmulationEnabled", { enabled: true }),
        ]);
    }

    async close()
    {
        this.session.connection.removeSession(this.session.id);

        await this.session.connection.send("Target.disposeBrowserContext", { browserContextId: this.browserContextId });
    }

    /* NAVIGATION AND SCRIPTS *************************************************/

    async goto(url, { timeout = 30000 } = {})
    {
        const loaded = this.session.waitForEvent("Page.loadEventFired", timeout);

        try
        {
            const result = await this.session.send("Page.navigate", { url });

            if(result.errorText) { throw new Error("Could not open " + url + ": " + result.errorText); }

            // Page.navigate returns no loaderId for a same-document navigation, which fires no load event.
            if(!result.loaderId) { loaded.cancel(); }
            else { await loaded.promise; }
        }
        catch(error)
        {
            loaded.cancel();

            throw error;
        }
    }

    async evaluate(expressionOrFunction, ...args)
    {
        const expression = typeof expressionOrFunction === "function"
            ? "(" + expressionOrFunction.toString() + ")(..." + JSON.stringify(args) + ")"
            : expressionOrFunction;

        const response = await this.session.send("Runtime.evaluate",
        {
            expression,
            returnByValue: true,
            awaitPromise: true,
        });

        if(response.exceptionDetails) { throw new Error(Page.describeException(response.exceptionDetails)); }

        return response.result.value;
    }

    async waitFor(predicate, { timeout = 10000, interval = 50 } = {})
    {
        const deadline = Date.now() + timeout;

        let lastError = null;

        do
        {
            try
            {
                const value = await this.evaluate(predicate);

                if(value) { return value; }
            }
            catch(error)
            {
                lastError = error;
            }

            await timers.setTimeout(interval);
        }
        while(Date.now() < deadline);

        const source = String(predicate).slice(0, 120);
        const reason = lastError ? " The last check threw: " + lastError.message : "";

        throw new Error("Timed out after " + timeout + " ms waiting for " + source + "." + reason);
    }

    async screenshot(filePath)
    {
        const { data } = await this.session.send("Page.captureScreenshot", { format: "png" });

        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, Buffer.from(data, "base64"));

        return filePath;
    }

    /* MOUSE ******************************************************************/

    async click(selector, options = {})
    {
        const box = await this.evaluate((targetSelector) =>
        {
            const element = document.querySelector(targetSelector);

            if(!element) { return null; }

            element.scrollIntoView({ block: "center", inline: "center" });

            const rect = element.getBoundingClientRect();

            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height };
        }, selector);

        if(!box) { throw new Error("No element matches " + selector + "."); }

        if(box.width === 0 || box.height === 0) { throw new Error("The element " + selector + " has no size to click."); }

        await this.clickAt(box.x, box.y, options);
    }

    async clickAt(x, y, { button = "left" } = {})
    {
        const buttons = Page.buttonMask(button);

        await this.dispatchMouse({ type: "mouseMoved", x, y });
        await this.dispatchMouse({ type: "mousePressed", x, y, button, buttons, clickCount: 1 });
        await this.dispatchMouse({ type: "mouseReleased", x, y, button, buttons: 0, clickCount: 1 });
    }

    async mouseDrag(x1, y1, x2, y2, { button = "left", steps = 10 } = {})
    {
        const buttons = Page.buttonMask(button);

        await this.dispatchMouse({ type: "mouseMoved", x: x1, y: y1 });
        await this.dispatchMouse({ type: "mousePressed", x: x1, y: y1, button, buttons, clickCount: 1 });

        for(let step = 1; step <= steps; step++)
        {
            const x = x1 + (x2 - x1) * step / steps;
            const y = y1 + (y2 - y1) * step / steps;

            await this.dispatchMouse({ type: "mouseMoved", x, y, button, buttons });
        }

        await this.dispatchMouse({ type: "mouseReleased", x: x2, y: y2, button, buttons: 0, clickCount: 1 });
    }

    async wheel(x, y, deltaY)
    {
        await this.dispatchMouse({ type: "mouseWheel", x, y, deltaX: 0, deltaY });
    }

    dispatchMouse(event)
    {
        return this.session.send("Input.dispatchMouseEvent", event);
    }

    static buttonMask(button)
    {
        const mask = MOUSE_BUTTONS[button];

        if(mask === undefined) { throw new Error("Unknown mouse button: " + button + "."); }

        return mask;
    }

    /* KEYBOARD ***************************************************************/

    async keyDown(key)
    {
        const description = Page.describeKey(key);

        await this.session.send("Input.dispatchKeyEvent",
        {
            ...description,
            type: description.text ? "keyDown" : "rawKeyDown",
        });
    }

    async keyUp(key)
    {
        const description = Page.describeKey(key);

        await this.session.send("Input.dispatchKeyEvent",
        {
            ...description,
            type: "keyUp",
            text: undefined,
            unmodifiedText: undefined,
        });
    }

    async press(key, holdMs = 0)
    {
        await this.keyDown(key);

        if(holdMs > 0) { await timers.setTimeout(holdMs); }

        await this.keyUp(key);
    }

    static describeKey(key)
    {
        const name = key === "Space" ? " " : key;
        const named = NAMED_KEYS[name];

        if(named) { return Page.keyEvent(name, named.code, named.keyCode, named.text, named.location); }

        if(/^[a-z]$/i.test(name))
        {
            const upper = name.toUpperCase();

            return Page.keyEvent(name, "Key" + upper, upper.charCodeAt(0), name);
        }

        if(/^[0-9]$/.test(name)) { return Page.keyEvent(name, "Digit" + name, name.charCodeAt(0), name); }

        throw new Error("Unsupported key: " + key + ".");
    }

    static keyEvent(key, code, keyCode, text = undefined, location = undefined)
    {
        const event =
        {
            key,
            code,
            windowsVirtualKeyCode: keyCode,
            nativeVirtualKeyCode: keyCode,
            text,
            unmodifiedText: text,
            location,
        };

        return event;
    }

    /* ERRORS *****************************************************************/

    recordException(details)
    {
        this.errors.push("Uncaught exception: " + Page.describeException(details));
    }

    recordConsoleCall({ type, args, stackTrace })
    {
        if(type !== "error" && type !== "assert") { return; }

        const text = args.map((arg) => Page.formatRemoteObject(arg)).join(" ");
        const frame = stackTrace?.callFrames[0];
        const location = frame?.url ? " (" + frame.url + ":" + (frame.lineNumber + 1) + ")" : "";

        this.errors.push("console." + type + ": " + text + location);
    }

    recordLogEntry(entry)
    {
        if(entry.level !== "error") { return; }

        // Chrome requests /favicon.ico by itself, whatever the page links.
        if(entry.url && new URL(entry.url).pathname === "/favicon.ico") { return; }

        const location = entry.url ? " (" + entry.url + ")" : "";

        this.errors.push(entry.source + ": " + entry.text + location);
    }

    static describeException(details)
    {
        const exception = details.exception;

        if(exception?.description) { return exception.description; }

        if(exception && "value" in exception) { return String(exception.value); }

        return details.text;
    }

    static formatRemoteObject(remoteObject)
    {
        if(remoteObject.type === "string") { return remoteObject.value; }

        if("value" in remoteObject) { return JSON.stringify(remoteObject.value); }

        return remoteObject.unserializableValue ?? remoteObject.description ?? remoteObject.type;
    }
}


/******************************************************************************/
/* BROWSER                                                                    */
/******************************************************************************/

export class Browser
{
    constructor(browserProcess, connection, profileDir, viewport)
    {
        this.browserProcess = browserProcess;
        this.connection = connection;
        this.profileDir = profileDir;
        this.viewport = viewport;
        this.killOnExit = () => browserProcess.kill();

        process.once("exit", this.killOnExit);
    }

    static async launch({ headless = true, width = 1280, height = 800 } = {})
    {
        const executable = Browser.findExecutable();
        const profileDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "foreverquest-browser-"));

        const args =
        [
            "--remote-debugging-port=0",
            "--user-data-dir=" + profileDir,
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--window-size=" + width + "," + height,
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--hide-scrollbars",
            "--mute-audio",
            "about:blank",
        ];

        if(headless) { args.unshift("--headless=new"); }

        const browserProcess = childProcess.spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });

        try
        {
            const endpoint = await Browser.readEndpoint(browserProcess);
            const connection = await Connection.open(endpoint);

            return new Browser(browserProcess, connection, profileDir, { width, height });
        }
        catch(error)
        {
            browserProcess.kill();
            await Browser.removeProfile(profileDir);

            throw error;
        }
    }

    static findExecutable()
    {
        const candidates = process.env.CHROME_PATH ? [process.env.CHROME_PATH, ...BROWSER_PATHS] : BROWSER_PATHS;
        const executable = candidates.find((candidate) => fs.existsSync(candidate));

        if(!executable) { throw new Error("Could not find Chrome or Edge. Set CHROME_PATH to the browser executable."); }

        return executable;
    }

    static readEndpoint(browserProcess)
    {
        return new Promise((resolve, reject) =>
        {
            let output = "";

            const finish = (error, endpoint) =>
            {
                clearTimeout(timer);
                browserProcess.stderr.off("data", onData);
                browserProcess.off("exit", onExit);
                browserProcess.off("error", onError);

                // Chrome blocks when its stderr pipe fills up.
                browserProcess.stderr.resume();

                if(error) { reject(error); }
                else { resolve(endpoint); }
            };

            const onData = (chunk) =>
            {
                output += chunk;

                const match = DEVTOOLS_URL_PATTERN.exec(output);

                if(match) { finish(null, match[1]); }
            };

            const onExit = (code) =>
            {
                finish(new Error("The browser exited with code " + code + " before DevTools started.\n" + output.trim()));
            };

            const onError = (error) =>
            {
                finish(new Error("Could not start the browser: " + error.message));
            };

            const timer = setTimeout(() =>
            {
                finish(new Error("The browser did not start DevTools within " + LAUNCH_TIMEOUT_MS + " ms.\n" + output.trim()));
            }, LAUNCH_TIMEOUT_MS);

            browserProcess.stderr.setEncoding("utf8");
            browserProcess.stderr.on("data", onData);
            browserProcess.once("exit", onExit);
            browserProcess.once("error", onError);
        });
    }

    async newPage()
    {
        const { browserContextId } = await this.connection.send("Target.createBrowserContext", { disposeOnDetach: true });
        const { targetId } = await this.connection.send("Target.createTarget", { url: "about:blank", browserContextId });
        const { sessionId } = await this.connection.send("Target.attachToTarget", { targetId, flatten: true });

        const page = new Page(this.connection.createSession(sessionId), browserContextId);

        await page.initialise(this.viewport);

        return page;
    }

    async close()
    {
        process.off("exit", this.killOnExit);

        const hasExited = await this.requestExit();

        if(!hasExited)
        {
            this.browserProcess.kill();
            await Browser.waitForExit(this.browserProcess, CLOSE_TIMEOUT_MS);
        }

        this.connection.close();
        await Browser.removeProfile(this.profileDir);
    }

    async requestExit()
    {
        const exited = Browser.waitForExit(this.browserProcess, CLOSE_TIMEOUT_MS);

        try
        {
            await this.connection.send("Browser.close");
        }
        catch(error)
        {
            Log.warn("Browser.close failed, so the browser process will be killed.", error);
        }

        return exited;
    }

    static waitForExit(browserProcess, timeoutMs)
    {
        if(browserProcess.exitCode !== null || browserProcess.signalCode !== null) { return Promise.resolve(true); }

        return new Promise((resolve) =>
        {
            const timer = setTimeout(() => resolve(false), timeoutMs);

            browserProcess.once("exit", () =>
            {
                clearTimeout(timer);
                resolve(true);
            });
        });
    }

    static async removeProfile(profileDir)
    {
        try
        {
            // Windows holds file locks briefly after the browser exits; rm retries on EBUSY and EPERM.
            await fs.promises.rm(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        }
        catch(error)
        {
            Log.warn("Could not remove the temporary browser profile " + profileDir, error);
        }
    }
}
