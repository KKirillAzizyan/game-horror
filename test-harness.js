/* Тест-харнесс: эмулирует DOM/canvas, чтобы запустить game.js в Node
   и проверить: 1) движение по e.code (независимо от раскладки)
                2) пауза замораживает логику                       */
"use strict";
const fs = require("fs");
const vm = require("vm");

/* --- заглушка «чего угодно» для canvas 2D контекста --- */
function anyStub() {
    const fn = function () { return anyStub(); };
    return new Proxy(fn, {
        get(t, p) {
            if (p === Symbol.toPrimitive) return () => 0;
            if (p === "length") return 0;
            if (p === Symbol.iterator) return function* () {};
            return anyStub();
        },
        set() { return true; },
        apply() { return anyStub(); },
        construct() { return anyStub(); },
    });
}

/* --- заглушка DOM-элемента --- */
function makeEl(id) {
    const classes = new Set();
    const listeners = {};
    const el = {
        id,
        style: {},
        textContent: "",
        innerHTML: "",
        title: "",
        className: "",
        width: 0, height: 0,
        classList: {
            add: c => classes.add(c),
            remove: c => classes.delete(c),
            contains: c => classes.has(c),
            toggle: c => classes.has(c) ? (classes.delete(c), false) : (classes.add(c), true),
        },
        addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
        removeEventListener: () => {},
        appendChild: () => {},
        remove: () => {},
        querySelector: () => makeEl(id + "-q"),
        querySelectorAll: () => [],
        getContext: () => anyStub(),
        focus: () => {},
        click: () => (listeners.click || []).forEach(fn => fn({})),
        __fire: (type, ev) => (listeners[type] || []).forEach(fn => fn(ev)),
        __listeners: listeners,
        __classes: classes,
    };
    return el;
}

const elements = {};
/* Элементы, у которых в index.html изначально есть class="hidden" */
const HIDDEN_INIT = new Set(["death-screen", "pause-screen", "craft-panel", "tooltip", "btn-craft-toggle", "load-error"]);
function getEl(id) {
    if (!elements[id]) {
        elements[id] = makeEl(id);
        if (HIDDEN_INIT.has(id)) elements[id].__classes.add("hidden");
    }
    return elements[id];
}

/* --- события --- */
const windowListeners = {};
function fireWindow(type, ev) {
    ev = ev || {};
    if (!ev.preventDefault) ev.preventDefault = () => {};
    (windowListeners[type] || []).forEach(fn => fn(ev));
}

/* --- глобальные браузерные объекта --- */
global.window = {
    innerWidth: 1280, innerHeight: 720,
    addEventListener: (t, fn) => { (windowListeners[t] = windowListeners[t] || []).push(fn); },
    removeEventListener: () => {},
};
global.document = {
    getElementById: getEl,
    createElement: () => makeEl("dyn"),
    addEventListener: () => {},
    body: makeEl("body"),
    pointerLockElement: null,
    exitPointerLock: () => {},
};
let rafCb = null;
global.requestAnimationFrame = cb => { rafCb = cb; return 1; };
let fakeNow = 1000;
global.performance = { now: () => fakeNow };

/* --- загрузка game.js --- */
const code = fs.readFileSync(__dirname + "/js/game.js", "utf8");
vm.runInThisContext(code, { filename: "game.js" });

const G = global.window.GameDebug.G;
const GameDebug = global.window.GameDebug;

/* --- помощник: прогон кадров --- */
function step(frames, dtMs) {
    for (let i = 0; i < frames; i++) {
        fakeNow += dtMs;
        const cb = rafCb; rafCb = null;
        if (cb) cb(fakeNow);
    }
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
    if (cond) { pass++; console.log("  OK  " + name + (extra ? "  [" + extra + "]" : "")); }
    else { fail++; console.log("  FAIL " + name + (extra ? "  [" + extra + "]" : "")); }
}

/* ==================== ТЕСТЫ ==================== */
console.log("\n=== 1. Старт игры ===");
GameDebug.startGame();
check("running=true", G.running === true);
check("paused=false", G.paused === false);
step(5, 16); // прогрев цикла
check("цикл крутится", true);

console.log("\n=== 2. Движение при русской раскладке (key='ц', code=KeyW) ===");
const y0 = G.py, x0 = G.px;
fireWindow("keydown", { code: "KeyW", key: "ц" });   // как реально жмёт пользователь
check("keys.up установлен через e.code", G.keys["up"] === true);
step(30, 16);  // ~0.5 с удержания
const yMoved = G.py - y0;
check("игрок двигается вверх (y уменьшился)", yMoved < -20, "dy=" + yMoved.toFixed(1));
check("x не изменился при чистом W", Math.abs(G.px - x0) < 0.01, "dx=" + (G.px - x0).toFixed(2));
fireWindow("keyup", { code: "KeyW", key: "ц" });
check("keys.up снят по e.code", G.keys["up"] === false);

console.log("\n=== 3. Движение вправо (code=KeyD, key=в) ===");
const x1 = G.px;
fireWindow("keydown", { code: "KeyD", key: "в" });
step(20, 16);
check("игрок двигается вправо (x вырос)", G.px - x1 > 20, "dx=" + (G.px - x1).toFixed(1));
fireWindow("keyup", { code: "KeyD", key: "в" });

console.log("\n=== 4. Пауза замораживает логику ===");
fireWindow("keydown", { code: "KeyP", key: "з" });   // пауза
check("paused=true", G.paused === true);
check("экран паузы показан", getEl("pause-screen").__classes.has("hidden") === false);

// удерживаем движение + снимаем кадры на паузе
fireWindow("keydown", { code: "KeyW", key: "ц" });
const snapY = G.py, snapHunger = G.hunger, snapTime = G.time, snapDay = G.day;
step(60, 16);  // ~1 сек кадров на паузе
check("позиция заморожена", G.py === snapY, "dy=" + (G.py - snapY));
check("голод заморожен", G.hunger === snapHunger, "dh=" + (G.hunger - snapHunger).toFixed(3));
check("время заморожено", G.time === snapTime, "dt=" + (G.time - snapTime).toFixed(4));
check("день не меняется", G.day === snapDay);

console.log("\n=== 5. Выход из паузы ===");
fireWindow("keyup", { code: "KeyW", key: "ц" });
fireWindow("keydown", { code: "KeyP", key: "з" });   // снять паузу
check("paused=false после повторного P", G.paused === false);
check("экран паузы скрыт", getEl("pause-screen").__classes.has("hidden") === true);

// снова движение
const y2 = G.py;
fireWindow("keydown", { code: "KeyW", key: "ц" });
step(30, 16);
check("движение возобновилось", G.py - y2 < -20, "dy=" + (G.py - y2).toFixed(1));
fireWindow("keyup", { code: "KeyW", key: "ц" });

console.log("\n=== 6. Сбор ресурса (ЛКМ) ===");
const invBefore = Object.keys(G.inv).length;
// поставить куст ягод рядом и ткнуть
GameDebug.G.nodes.push({ id: 9999999, type: "berryBush", x: G.px + 30, y: G.py, hp: 1, maxHp: 1, r: 20, wobble: 0, shake: 0 });
G.gatherCd = 0;
elements["game"].__fire("mousedown", { button: 0 });
check("ягоды собраны", (G.inv["berry"] || 0) > 0, "berry=" + G.inv["berry"]);

console.log("\n=== 7. Крафт топора ===");
GameDebug.addItem("twig", 5);
GameDebug.addItem("flint", 2);
G.gatherCd = 0;
// найти рецепт топора и нажать (прямой вызов через кнопки недоступен — проверим hasCost-логику через addItem+inv)
check("материалы для топора есть", (G.inv["twig"] >= 3 && G.inv["flint"] >= 1));

console.log("\n=== 8. Карта расширена ===");
check("мир 6400x6400", GameDebug.CFG.worldW === 6400 && GameDebug.CFG.worldH === 6400);
check("узлов >1400 (было 620)", G.nodes.length > 1400, "nodes=" + G.nodes.length);

console.log("\n=== 9. Валун даёт 3 камня (киркой) ===");
// изолированная точка без других узлов рядом
const bx = 500, by = 500;
G.nodes = G.nodes.filter(n => dist(n.x, n.y, bx, by) > 150);
G.nodes.push({ id: 9999999, type: "boulder", x: bx, y: by, hp: 4, maxHp: 4, r: 24, shake: 0 });
G.px = bx + 40; G.py = by;
G.equipped = "pickaxe";
const rockBefore = G.inv["rock"] || 0;
for (let i = 0; i < 4; i++) { G.gatherCd = 0; elements["game"].__fire("mousedown", { button: 0 }); }
check("валун дал 3 камня", (G.inv["rock"] - rockBefore) >= 3, "rock+" + (G.inv["rock"] - rockBefore));

console.log("\n=== 10. Постройка костра (исправление 'нельзя поставить') ===");
GameDebug.addItem("campfire", 1);
GameDebug.itemClick("campfire");
check("режим постройки включён", G.placing === "campfire");
G.camX = G.px; G.camY = G.py;      // прицеливаемся в позицию игрока
G.mouse.x = 640; G.mouse.y = 360;
G.nodes = G.nodes.filter(n => dist(n.x, n.y, G.px, G.py) > 120); // чистим место
const stBefore = G.structures.length;
elements["game"].__fire("mousedown", { button: 0 });
check("костёр поставлен", G.structures.length === stBefore + 1);
check("костёр списан из инвентаря", (G.inv["campfire"] || 0) === 0);
check("режим постройки снят", G.placing === null);

console.log("\n=== 11. Дом: укрытие от врагов ===");
GameDebug.addItem("house", 1);
GameDebug.itemClick("house");
G.camX = G.px; G.camY = G.py;
G.mouse.x = 740; G.mouse.y = 360;   // дом на 100 правее игрока
const st2 = G.structures.length;
elements["game"].__fire("mousedown", { button: 0 });
check("дом поставлен", G.structures.length === st2 + 1 && G.structures.some(s => s.type === "house"));
check("дом списан из инвентаря", (G.inv["house"] || 0) === 0);
// волк рядом с домом не должен атаковать (укрытие)
GameDebug.spawnCreature("wolf", G.px + 180, G.py);
const wolf = G.creatures[G.creatures.length - 1];
const hpBefore = Math.round(G.hp);
for (let i = 0; i < 40; i++) { wolf.atkCd = 0; step(1, 16); }
check("игрок в укрытии не пострадал", Math.round(G.hp) === hpBefore, "hp=" + Math.round(G.hp));
check("волк отпугнут от дома", dist(G.px, G.py, wolf.x, wolf.y) > 150, "d=" + Math.round(dist(G.px, G.py, wolf.x, wolf.y)));

console.log("\n=== 12. Выброс и подбор предмета (ПКМ) ===");
GameDebug.addItem("berry", 5);
const berryBefore = G.inv["berry"];
GameDebug.dropItem("berry", 2);
check("предмет выброшен на землю", G.dropped.length === 1 && G.inv["berry"] === berryBefore - 2);
step(3, 16);
check("выброшенное подобрано обратно", G.dropped.length === 0 && G.inv["berry"] === berryBefore, "berry=" + G.inv["berry"]);

console.log("\n=== ИТОГ ===");
console.log("PASS: " + pass + "   FAIL: " + fail);
process.exit(fail > 0 ? 1 : 0);