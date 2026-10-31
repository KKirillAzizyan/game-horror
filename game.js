/* =====================================================================
   ГОЛОДНЫЕ ПУСТОШИ — выживалка на чистом JS + Canvas 2D
   Вид сверху, стиль Don't Starve. Без внешних зависимостей.
   ===================================================================== */
"use strict";

/* ---------------------------------------------------------------------
   1. КОНФИГУРАЦИЯ
   --------------------------------------------------------------------- */
const CFG = {
    worldW: 3600, worldH: 3600,
    playerSpeed: 190,          // px/sec
    sprintSpeed: 300,
    dashTime: 0.18, dashCd: 1.4, dashBoost: 3.2,
    gatherRange: 62,
    attackRange: 66,
    dayLength: 150,            // секунд на полный цикл (день+ночь)
    nightStart: 0.62,          // доля цикла, когда начинается ночь
    dawnStart: 0.92,
    hungerDecay: 100 / 210,    // полный голод за ~3.5 минуты
    sanityNightDecay: 100 / 130,
    sanityDayGain: 100 / 260,
    starvingDps: 4,
    stackMax: 99,
    invSlots: 10,
};

/* ---------------------------------------------------------------------
   2. ПРЕДМЕТЫ
   --------------------------------------------------------------------- */
const ITEMS = {
    twig:      { name: "Ветки",       icon: "🌿", cat: "res" },
    flint:     { name: "Кремень",     icon: "🪨", cat: "res" },
    grass:     { name: "Трава",       icon: "🌾", cat: "res" },
    log:       { name: "Брёвна",      icon: "🪵", cat: "res" },
    rock:      { name: "Камни",       icon: "🪨", cat: "res" },
    berry:     { name: "Ягоды",       icon: "🫐", cat: "food", food: 18, san: 4 },
    meat:      { name: "Сырое мясо",  icon: "🥩", cat: "food", food: 22 },
    cookedMeat:{ name: "Жареное мясо",icon: "🍖", cat: "food", food: 48, hp: 6 },
    mushroom:  { name: "Гриб",        icon: "🍄", cat: "food", food: 12, san: -6 },
    gem:       { name: "Кристалл",    icon: "💎", cat: "res" },
    bandage:   { name: "Повязка",     icon: "🩹", cat: "use", heal: 35 },
    axe:       { name: "Топор",       icon: "🪓", cat: "tool", dmg: 14, onTree: true },
    pickaxe:   { name: "Кирка",       icon: "⛏️", cat: "tool", dmg: 10, onRock: true },
    spear:     { name: "Копьё",       icon: "🗡️", cat: "tool", dmg: 26 },
    torch:     { name: "Факел",       icon: "🕯️", cat: "tool", dmg: 6, light: 150 },
    campfire:  { name: "Костёр",      icon: "🔥", cat: "build", light: 260 },
};

const RECIPES = [
    { out: "axe",      cost: { twig: 3, flint: 1 } },
    { out: "pickaxe",  cost: { twig: 3, rock: 2 } },
    { out: "spear",    cost: { twig: 4, flint: 3 } },
    { out: "torch",    cost: { twig: 2, flint: 1, grass: 1 } },
    { out: "campfire", cost: { log: 4, rock: 3 } },
    { out: "bandage",  cost: { grass: 3, berry: 2 } },
];

/* ---------------------------------------------------------------------
   3. РЕСУРСЫ МИРА
   --------------------------------------------------------------------- */
const NODE_TYPES = {
    tree:      { name: "Дерево",        hp: 3, tool: "axe",     drop: "log",   r: 26, col: "#2f6b3a" },
    boulder:   { name: "Валун",         hp: 4, tool: "pickaxe", drop: "rock",  r: 24, col: "#777" },
    berryBush: { name: "Ягодный куст",  hp: 1, tool: null,      drop: "berry", r: 20, col: "#7b2d5e", dropQty: 3 },
    grassTuft: { name: "Пучок травы",   hp: 1, tool: null,      drop: "grass", r: 15, col: "#4e9c3f", dropQty: 2 },
    flintRock: { name: "Кремень",       hp: 2, tool: null,      drop: "flint", r: 14, col: "#5a5170", dropQty: 2 },
    twigBush:  { name: "Ветвистый куст",hp: 1, tool: null,      drop: "twig",  r: 16, col: "#8a6b3a", dropQty: 3 },
    mushroom:  { name: "Грибница",      hp: 1, tool: null,      drop: "mushroom", r: 13, col: "#c9a227", dropQty: 1 },
    deadTree:  { name: "Сухое дерево",  hp: 2, tool: "axe",     drop: "log",   r: 22, col: "#5c4a32", dropQty: 2 },
};

/* ---------------------------------------------------------------------
   4. ЖИВОТНЫЕ И БОССЫ
   --------------------------------------------------------------------- */
const CREATURE_TYPES = {
    rabbit:  { name: "Кролик",   hp: 12,  spd: 150, r: 11, col: "#d9d0c7", dmg: 0,  passive: true,  flee: 170, loot: { meat: 1 } },
    deer:    { name: "Олень",    hp: 30,  spd: 130, r: 19, col: "#a3763f", dmg: 0,  passive: true,  flee: 230, loot: { meat: 2 } },
    boar:    { name: "Кабан",    hp: 45,  spd: 110, r: 21, col: "#6b4a3a", dmg: 9,  passive: false, aggro: 200, fleeHp: 0.3, loot: { meat: 3 } },
    spider:  { name: "Паук",     hp: 26,  spd: 118, r: 15, col: "#2c1b3d", dmg: 7,  passive: false, aggro: 340, night: true, loot: { twig: 1 } },
    wolf:    { name: "Волк",     hp: 48,  spd: 165, r: 19, col: "#57606b", dmg: 13, passive: false, aggro: 420, night: true, loot: { meat: 2 } },
    golem:   { name: "Каменный голем", hp: 240, spd: 62, r: 42, col: "#6d6d78", dmg: 24, passive: false, aggro: 520, boss: true, loot: { gem: 2, rock: 6 } },
    shade:   { name: "Теневой зверь",  hp: 170, spd: 190, r: 34, col: "#180f2b", dmg: 18, passive: false, aggro: 640, boss: true, night: true, loot: { gem: 1, meat: 3 } },
};

/* ---------------------------------------------------------------------
   5. СОСТОЯНИЕ
   --------------------------------------------------------------------- */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let W = 0, H = 0;

const G = {
    running: false,
    paused: false,
    time: 0,          // общее время, сек
    day: 1,
    dayPhase: 0,      // 0..1 внутри цикла
    hp: 100, maxHp: 100,
    hunger: 100,
    sanity: 100,
    px: 0, py: 0,     // позиция игрока (мировые координаты)
    pvx: 0, pvy: 0,   // направление взгляда
    facing: 0,
    dashT: 0, dashCd: 0,
    inv: {},          // id -> qty
    equipped: null,
    nodes: [],        // ресурсы
    creatures: [],    // животные
    structures: [],   // постройки
    particles: [],    // всплывающие цифры/эффекты
    floaters: [],
    camX: 0, camY: 0,
    spawnTimer: 0,
    bossTimer: 0,
    deathReason: "",
    hurtFlash: 0,
    gatherCd: 0,
    lastHitId: 0,
    mouse: { x: 0, y: 0, down: false },
    keys: {},
    shake: 0,
};

/* ---------------------------------------------------------------------
   6. УТИЛИТЫ
   --------------------------------------------------------------------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

/* ---------------------------------------------------------------------
   7. ИНВЕНТАРЬ
   --------------------------------------------------------------------- */
function addItem(id, qty) {
    qty = qty || 1;
    G.inv[id] = Math.min(CFG.stackMax, (G.inv[id] || 0) + qty);
    renderInventory();
}
function removeItem(id, qty) {
    qty = qty || 1;
    if (!G.inv[id] || G.inv[id] < qty) return false;
    G.inv[id] -= qty;
    if (G.inv[id] <= 0) {
        delete G.inv[id];
        if (G.equipped === id) G.equipped = null;
    }
    renderInventory();
    return true;
}
function countItem(id) { return G.inv[id] || 0; }
function hasCost(cost) {
    for (const k in cost) if (countItem(k) < cost[k]) return false;
    return true;
}

/* ---------------------------------------------------------------------
   8. ГЕНЕРАЦИЯ МИРА
   --------------------------------------------------------------------- */
function spawnNode(type, x, y) {
    const t = NODE_TYPES[type];
    G.nodes.push({
        id: ++G.lastHitId, type, x, y,
        hp: t.hp, maxHp: t.hp, r: t.r,
        wobble: rnd(0, Math.PI * 2),
        shake: 0,
    });
}
function generateWorld() {
    G.nodes = [];
    const N = 620;
    for (let i = 0; i < N; i++) {
        const x = rnd(80, CFG.worldW - 80);
        const y = rnd(80, CFG.worldH - 80);
        if (dist(x, y, CFG.worldW / 2, CFG.worldH / 2) < 160) continue;
        const r = Math.random();
        let type;
        if (r < 0.30) type = "tree";
        else if (r < 0.44) type = "deadTree";
        else if (r < 0.56) type = "boulder";
        else if (r < 0.68) type = "berryBush";
        else if (r < 0.80) type = "grassTuft";
        else if (r < 0.88) type = "twigBush";
        else if (r < 0.95) type = "flintRock";
        else type = "mushroom";
        spawnNode(type, x, y);
    }
    // стартовый набор рядом со спавном — чтобы было чем заняться сразу
    const cx = CFG.worldW / 2, cy = CFG.worldH / 2;
    const starter = ["tree", "tree", "twigBush", "twigBush", "grassTuft", "grassTuft",
                     "berryBush", "flintRock", "flintRock", "boulder", "mushroom", "deadTree"];
    starter.forEach((t, i) => {
        const a = (i / starter.length) * Math.PI * 2;
        spawnNode(t, cx + Math.cos(a) * rnd(130, 220), cy + Math.sin(a) * rnd(130, 220));
    });
}

function respawnNodes(dt) {
    // мир восстанавливается со временем
    if (G.nodes.length < 640 && Math.random() < dt * 3) {
        const edge = Math.random() < 0.5;
        let x, y;
        if (edge) {
            x = Math.random() < 0.5 ? rnd(40, CFG.worldW - 40) : (Math.random() < 0.5 ? 40 : CFG.worldW - 40);
            y = rnd(40, CFG.worldH - 40);
        } else {
            x = rnd(40, CFG.worldW - 40); y = rnd(40, CFG.worldH - 40);
        }
        if (dist(x, y, G.px, G.py) < 500) return;
        const r = Math.random();
        spawnNode(r < 0.3 ? "tree" : r < 0.5 ? "boulder" : r < 0.65 ? "berryBush" :
            r < 0.78 ? "grassTuft" : r < 0.88 ? "twigBush" : r < 0.95 ? "flintRock" : "mushroom", x, y);
    }
}

/* ---------------------------------------------------------------------
   9. СПАВН ЖИВОТНЫХ
   --------------------------------------------------------------------- */
function spawnCreature(type, x, y) {
    const t = CREATURE_TYPES[type];
    G.creatures.push({
        id: ++G.lastHitId, type, x, y,
        hp: t.hp, maxHp: t.hp, r: t.r,
        vx: 0, vy: 0,
        wanderT: rnd(0, 2), wx: x, wy: y,
        atkCd: 0, hitFlash: 0,
        anim: rnd(0, Math.PI * 2),
        boss: !!t.boss,
    });
}
function pickSpawnPos(minDist, maxDist) {
    const a = rnd(0, Math.PI * 2);
    const d = rnd(minDist, maxDist);
    return [clamp(G.px + Math.cos(a) * d, 60, CFG.worldW - 60),
            clamp(G.py + Math.sin(a) * d, 60, CFG.worldH - 60)];
}
function spawnWildlife() {
    const [x, y] = pickSpawnPos(500, 950);
    const r = Math.random();
    let type;
    if (r < 0.45) type = "rabbit";
    else if (r < 0.75) type = "deer";
    else type = "boar";
    spawnCreature(type, x, y);
}
function spawnNightEnemy() {
    const [x, y] = pickSpawnPos(430, 760);
    spawnCreature(Math.random() < 0.55 ? "spider" : "wolf", x, y);
}
function spawnBoss() {
    const [x, y] = pickSpawnPos(560, 760);
    const type = G.day % 3 === 0 ? "shade" : "golem";
    spawnCreature(type, x, y);
    toast("⚠ " + CREATURE_TYPES[type].name + " пробудился неподалёку!", "#e74c3c");
}

/* ---------------------------------------------------------------------
   10. ЧАСЫ / ДЕНЬ-НОЧЬ
   --------------------------------------------------------------------- */
function phaseInfo() {
    const p = G.dayPhase;
    if (p < CFG.nightStart) return { night: false, name: "День" };
    if (p < CFG.dawnStart) return { night: true, name: "Ночь" };
    return { night: false, name: "Рассвет" };
}
function nightFactor() {
    const p = G.dayPhase;
    if (p < CFG.nightStart - 0.06) return 0;
    if (p < CFG.nightStart) return (p - (CFG.nightStart - 0.06)) / 0.06;
    if (p < CFG.dawnStart) return 1;
    if (p < CFG.dawnStart + 0.05) return 1 - (p - CFG.dawnStart) / 0.05;
    return 0;
}

/* ---------------------------------------------------------------------
   11. ВСПЛЫВАЮЩИЕ ЭФФЕКТЫ
   --------------------------------------------------------------------- */
function floater(x, y, text, color) {
    G.floaters.push({ x, y, text, color: color || "#fff", t: 0, life: 1.1, vy: -46 });
}
function toast(text, color) {
    const el = document.createElement("div");
    el.className = "toast-msg";
    el.textContent = text;
    if (color) el.style.color = color;
    document.getElementById("toast").appendChild(el);
    setTimeout(() => el.remove(), 2700);
}

/* ---------------------------------------------------------------------
   12. СБОР РЕСУРСОВ
   --------------------------------------------------------------------- */
function nearestNode(range) {
    let best = null, bd = range;
    for (const n of G.nodes) {
        const d = dist(G.px, G.py, n.x, n.y);
        if (d < bd) { bd = d; best = n; }
    }
    return best;
}
function nearestCreature(range) {
    let best = null, bd = range;
    for (const c of G.creatures) {
        const d = dist(G.px, G.py, c.x, c.y);
        if (d < bd) { bd = d; best = c; }
    }
    return best;
}

function gather() {
    const n = nearestNode(CFG.gatherRange);
    if (!n) return false;
    const def = NODE_TYPES[n.type];
    if (def.tool && !(G.equipped && ITEMS[G.equipped] && ITEMS[G.equipped][def.tool === "axe" ? "onTree" : "onRock"])) {
        toast(def.tool === "axe" ? "Нужен топор, чтобы рубить деревья" : "Нужна кирка, чтобы ломать камни", "#e67e22");
        return true;
    }
    n.hp -= 1;
    n.shake = 1;
    floater(n.x, n.y - n.r, "-1", "#fff");
    if (n.hp <= 0) {
        const qty = def.dropQty || 1;
        addItem(def.drop, qty);
        floater(n.x, n.y - n.r, "+" + qty + " " + ITEMS[def.drop].name, "#2ecc71");
        G.nodes = G.nodes.filter(x => x !== n);
        G.sanity = clamp(G.sanity + 2, 0, 100);
    }
    return true;
}

/* ---------------------------------------------------------------------
   13. БОЙ
   --------------------------------------------------------------------- */
function attack() {
    const c = nearestCreature(CFG.attackRange);
    if (!c) return false;
    const wep = G.equipped ? ITEMS[G.equipped] : null;
    const dmg = wep && wep.dmg ? wep.dmg : 8;
    c.hp -= dmg;
    c.hitFlash = 1;
    // отбрасывание
    const d = dist(G.px, G.py, c.x, c.y) || 1;
    c.x += (c.x - G.px) / d * 14;
    c.y += (c.y - G.py) / d * 14;
    floater(c.x, c.y - c.r, "-" + dmg, "#ff5252");
    G.shake = Math.min(7, G.shake + 3);
    if (c.hp <= 0) killCreature(c);
    return true;
}
function killCreature(c) {
    const def = CREATURE_TYPES[c.type];
    for (const k in def.loot) addItem(k, def.loot[k]);
    const lootNames = Object.keys(def.loot).map(k => def.loot[k] + " " + ITEMS[k].name).join(", ");
    floater(c.x, c.y, "+" + lootNames, "#f1c40f");
    if (def.boss) { toast("🏆 " + def.name + " повержен! Добыча: " + lootNames, "#f1c40f"); G.shake = 10; }
    // кровавые частицы
    for (let i = 0; i < 8; i++) {
        G.particles.push({ x: c.x, y: c.y, vx: rnd(-90, 90), vy: rnd(-90, 90), t: 0, life: 0.5, col: "#a33" });
    }
    G.creatures = G.creatures.filter(x => x !== c);
    G.sanity = clamp(G.sanity - (def.boss ? 0 : 3), 0, 100);
}

function damagePlayer(amount, reason) {
    G.hp = clamp(G.hp - amount, 0, G.maxHp);
    G.hurtFlash = 1;
    G.shake = Math.min(12, G.shake + 5);
    floater(G.px, G.py - 30, "-" + Math.round(amount), "#ff1744");
    if (G.hp <= 0) die(reason);
}

/* ---------------------------------------------------------------------
   14. ЕДА / ИСПОЛЬЗОВАНИЕ
   --------------------------------------------------------------------- */
function consume(id) {
    const it = ITEMS[id];
    if (!it || it.cat !== "food") return false;
    removeItem(id, 1);
    G.hunger = clamp(G.hunger + (it.food || 0), 0, 100);
    if (it.hp) G.hp = clamp(G.hp + it.hp, 0, G.maxHp);
    if (it.san) G.sanity = clamp(G.sanity + it.san, 0, 100);
    floater(G.px, G.py - 34, "+" + it.food + " 🍖", "#2ecc71");
    return true;
}
function useBandage() {
    if (!removeItem("bandage", 1)) return false;
    G.hp = clamp(G.hp + ITEMS.bandage.heal, 0, G.maxHp);
    floater(G.px, G.py - 34, "+" + ITEMS.bandage.heal + " ❤️", "#2ecc71");
    return true;
}

/* ---------------------------------------------------------------------
   15. КРАФТ
   --------------------------------------------------------------------- */
function craft(recipe) {
    if (!hasCost(recipe.cost)) { toast("Не хватает ресурсов", "#e74c3c"); return; }
    for (const k in recipe.cost) removeItem(k, recipe.cost[k]);
    addItem(recipe.out, 1);
    toast("Создано: " + ITEMS[recipe.out].icon + " " + ITEMS[recipe.out].name, "#2ecc71");
    renderCraft();
}

/* ---------------------------------------------------------------------
   16. ИИ ЖИВОТНЫХ
   --------------------------------------------------------------------- */
function updateCreatures(dt) {
    const night = phaseInfo().night;
    for (const c of G.creatures) {
        const def = CREATURE_TYPES[c.type];
        c.hitFlash = Math.max(0, c.hitFlash - dt * 4);
        c.atkCd = Math.max(0, c.atkCd - dt);
        c.anim += dt * 7;

        const dx = G.px - c.x, dy = G.py - c.y;
        const d = Math.hypot(dx, dy) || 1;
        let mvx = 0, mvy = 0;
        let speed = def.spd;

        // ночью пассивные прячутся, враждебные активнее
        const isAggro = !def.passive && (def.aggro || 0) > 0 && d < (def.aggro || 0) &&
                        (!def.night || night) && (!def.boss || G.bossTimer <= 0 || true);

        if (def.passive) {
            // убегание
            if (d < (def.flee || 150)) {
                mvx = -dx / d; mvy = -dy / d;
                speed *= 1.15;
            } else {
                // блуждание
                c.wanderT -= dt;
                if (c.wanderT <= 0) {
                    c.wanderT = rnd(1.5, 4);
                    c.wx = c.x + rnd(-260, 260);
                    c.wy = c.y + rnd(-260, 260);
                }
                const wdx = c.wx - c.x, wdy = c.wy - c.y;
                const wd = Math.hypot(wdx, wdy) || 1;
                if (wd > 8) { mvx = wdx / wd; mvy = wdy / wd; speed *= 0.5; }
            }
        } else {
            // кабан трусит при низком HP
            if (def.fleeHp && c.hp < c.maxHp * def.fleeHp) {
                mvx = -dx / d; mvy = -dy / d; speed *= 1.2;
            } else if (isAggro) {
                if (d > c.r + 34) {
                    mvx = dx / d; mvy = dy / d;
                } else if (c.atkCd <= 0) {
                    damagePlayer(def.dmg, def.boss ? "Вас убил " + def.name : "Вас растерзали звери");
                    c.atkCd = def.boss ? 1.5 : 1.1;
                }
            } else {
                c.wanderT -= dt;
                if (c.wanderT <= 0) {
                    c.wanderT = rnd(1.5, 4);
                    c.wx = c.x + rnd(-220, 220);
                    c.wy = c.y + rnd(-220, 220);
                }
                const wdx = c.wx - c.x, wdy = c.wy - c.y;
                const wd = Math.hypot(wdx, wdy) || 1;
                if (wd > 8) { mvx = wdx / wd; mvy = wdy / wd; speed *= 0.45; }
            }
        }

        c.x = clamp(c.x + mvx * speed * dt, c.r, CFG.worldW - c.r);
        c.y = clamp(c.y + mvy * speed * dt, c.r, CFG.worldH - c.r);

        // расталкивание между собой (мягкое)
        for (const o of G.creatures) {
            if (o === c) continue;
            const odx = c.x - o.x, ody = c.y - o.y;
            const od = Math.hypot(odx, ody);
            const min = c.r + o.r;
            if (od > 0 && od < min) {
                const push = (min - od) * 0.5;
                c.x += odx / od * push;
                c.y += ody / od * push;
            }
        }
    }
}

/* ---------------------------------------------------------------------
   17. СПАВН ПО ВРЕМЕНИ
   --------------------------------------------------------------------- */
function updateSpawns(dt) {
    const night = phaseInfo().night;

    // пассивные животные днём
    G.spawnTimer -= dt;
    if (G.spawnTimer <= 0) {
        G.spawnTimer = 4.5;
        const wild = G.creatures.filter(c => !CREATURE_TYPES[c.type].boss).length;
        if (wild < 16) spawnWildlife();
    }

    // враги ночью
    if (night) {
        G.spawnTimer -= dt * 0; // (таймер общий)
        if (Math.random() < dt * 0.5) {
            const enemies = G.creatures.filter(c => !CREATURE_TYPES[c.type].passive).length;
            if (enemies < 8) spawnNightEnemy();
        }
    }

    // боссы каждые 2 дня ночью + шанс на рассвете
    G.bossTimer -= dt;
    if (G.day >= 2 && G.bossTimer <= 0) {
        if (night && Math.random() < dt * 0.25) {
            spawnBoss();
            G.bossTimer = 55;
        }
    }

    // слишком близко — удаляем, чтобы не заспавнились на голове
    for (const c of G.creatures) {
        if (dist(c.x, c.y, G.px, G.py) < 260 && !CREATURE_TYPES[c.type].boss) {
            // ок
        }
    }
}

/* ---------------------------------------------------------------------
   18. ОБНОВЛЕНИЕ ИГРОКА
   --------------------------------------------------------------------- */
function updatePlayer(dt) {
    let mx = 0, my = 0;
    if (G.keys["up"]) my -= 1;
    if (G.keys["down"]) my += 1;
    if (G.keys["left"]) mx -= 1;
    if (G.keys["right"]) mx += 1;

    if (mx || my) {
        const len = Math.hypot(mx, my);
        mx /= len; my /= len;
        G.facing = Math.atan2(my, mx);
    }

    G.dashCd = Math.max(0, G.dashCd - dt);
    G.dashT = Math.max(0, G.dashT - dt);
    let speed = G.keys["sprint"] ? CFG.sprintSpeed : CFG.playerSpeed;
    if (G.dashT > 0) speed *= CFG.dashBoost;

    const nx = G.px + mx * speed * dt;
    const ny = G.py + my * speed * dt;

    // столкновения с ресурсами (круг-круг)
    let bx = nx, by = ny;
    for (const n of G.nodes) {
        const d = dist(bx, by, n.x, n.y);
        const min = n.r + 16;
        if (d < min && d > 0.001) {
            bx = n.x + (bx - n.x) / d * min;
            by = n.y + (by - n.y) / d * min;
        }
    }
    G.px = clamp(bx, 24, CFG.worldW - 24);
    G.py = clamp(by, 24, CFG.worldH - 24);

    G.gatherCd = Math.max(0, G.gatherCd - dt);
}

/* ---------------------------------------------------------------------
   19. СТАТЫ
   --------------------------------------------------------------------- */
function updateStats(dt) {
    const night = phaseInfo().night;

    G.hunger = clamp(G.hunger - CFG.hungerDecay * dt, 0, 100);
    if (night) G.sanity = clamp(G.sanity - CFG.sanityNightDecay * dt, 0, 100);
    else G.sanity = clamp(G.sanity + CFG.sanityDayGain * dt, 0, 100);

    // рядом с костром — уют и рассудок
    let nearFire = false;
    for (const s of G.structures) {
        if (s.type === "campfire" && dist(G.px, G.py, s.x, s.y) < 170) { nearFire = true; break; }
    }
    if (nearFire && night) G.sanity = clamp(G.sanity + 14 * dt, 0, 100);

    if (G.hunger <= 0) {
        G.hp = clamp(G.hp - CFG.starvingDps * dt, 0, G.maxHp);
        if (G.hp <= 0) die("Голод убил вас.");
    } else if (G.hunger > 55 && G.hp < G.maxHp) {
        G.hp = clamp(G.hp + 1.6 * dt, 0, G.maxHp); // медленная регенерация
    }

    // очень низкий рассудок — галлюцинации (помехи)
    if (G.sanity <= 0 && Math.random() < dt * 0.5) {
        damagePlayer(3, "Рассудок окончательно сдал.");
    }
}

/* ---------------------------------------------------------------------
   20. ВВОД
   --------------------------------------------------------------------- */
/* Маппинг физической клавиши (e.code) → логическое действие.
   e.code НЕ зависит от раскладки (русская/английская и т.д.),
   поэтому WASD работает всегда. */
function mapCode(code) {
    switch (code) {
        case "KeyW": case "ArrowUp":    return "up";
        case "KeyS": case "ArrowDown":  return "down";
        case "KeyA": case "ArrowLeft":  return "left";
        case "KeyD": case "ArrowRight": return "right";
        case "ShiftLeft": case "ShiftRight": return "sprint";
        default: return null;
    }
}

function setupInput() {
    window.addEventListener("keydown", e => {
        // движение/спринт — по физической клавише, работает на любой раскладке
        const m = mapCode(e.code);
        if (m) { G.keys[m] = true; if (G.running) e.preventDefault(); }

        if (!G.running) return;

        // ПАУЗА: Escape или P
        if (e.code === "Escape" || e.code === "KeyP") {
            e.preventDefault();
            if (!document.getElementById("craft-panel").classList.contains("hidden")) {
                toggleCraft();   // сначала закрываем крафт
            } else {
                togglePause();
            }
            return;
        }
        if (G.paused) return;   // в паузе остальные действия заблокированы

        if (e.code === "KeyE") toggleInventoryHint();
        if (e.code === "KeyC") toggleCraft();
        if (e.code === "KeyR" || e.code === "Space") {
            if (G.dashCd <= 0 && G.dashT <= 0) {
                G.dashT = CFG.dashTime;
                G.dashCd = CFG.dashCd;
            }
            if (e.code === "Space") e.preventDefault();
        }
        // быстрое использование: 1-9 = слот инвентаря
        if (e.code.indexOf("Digit") === 0) {
            const n = parseInt(e.code.slice(5), 10);
            if (n >= 1 && n <= 9) slotAction(n - 1);
        }
        if (e.code === "KeyQ") dropOrUnequip();
    });

    window.addEventListener("keyup", e => {
        const m = mapCode(e.code);
        if (m) G.keys[m] = false;
    });

    canvas.addEventListener("mousemove", e => {
        G.mouse.x = e.clientX;
        G.mouse.y = e.clientY;
    });
    canvas.addEventListener("mousedown", e => {
        if (e.button !== 0 || !G.running || G.paused) return;
        if (G.gatherCd > 0) return;
        G.gatherCd = 0.28;

        // приоритет: существо > ресурс > постройка(костёр)
        if (attack()) return;
        if (gather()) return;

        // костёр: приготовить мясо
        for (const s of G.structures) {
            if (s.type === "campfire" && dist(G.px, G.py, s.x, s.y) < CFG.gatherRange + 30) {
                if (countItem("meat") > 0 && removeItem("meat", 1)) {
                    addItem("cookedMeat", 1);
                    toast("🔥 Приготовлено: Жареное мясо", "#f39c12");
                } else if (countItem("meat") === 0) {
                    toast("Нужно сырое мясо, чтобы жарить на костре", "#aaa");
                }
                return;
            }
        }
    });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
}

/* Пауза: останавливаем логику, мир продолжает рендериться */
function togglePause() {
    if (!G.running) return;
    G.paused = !G.paused;
    const el = document.getElementById("pause-screen");
    if (G.paused) {
        G.keys = {};                      // сбрасываем зажатые клавиши
        el.classList.remove("hidden");
        document.getElementById("pause-day").textContent =
            "День " + G.day + " · HP " + Math.ceil(G.hp) + " · Голод " + Math.ceil(G.hunger);
    } else {
        el.classList.add("hidden");
    }
}

function dropOrUnequip() {
    if (G.equipped) { G.equipped = null; renderInventory(); }
}

function toggleInventoryHint() {
    renderInventory();
    document.getElementById("hud-inventory").classList.toggle("flash");
    toast("Инвентарь: клик по предмету — использовать / экипировать", "#aaa");
}

/* Слоты инвентаря: клик = использовать/экипировать */
function slotAction(index) {
    const ids = Object.keys(G.inv);
    const id = ids[index];
    if (!id) return;
    itemClick(id);
}
function itemClick(id) {
    const it = ITEMS[id];
    if (!it || countItem(id) <= 0) return;
    if (it.cat === "food") { consume(id); return; }
    if (id === "bandage") { useBandage(); return; }
    if (it.cat === "tool") {
        G.equipped = G.equipped === id ? null : id;
        renderInventory();
        if (G.equipped) toast("Экипировано: " + it.icon + " " + it.name, "#f1c40f");
        return;
    }
    if (it.cat === "build") { toast("Выберите место и нажмите ЛКМ рядом, чтобы построить. (Пока — в разработке)", "#aaa"); }
}

/* ---------------------------------------------------------------------
   21. UI: инвентарь, крафт
   --------------------------------------------------------------------- */
function renderInventory() {
    const el = document.getElementById("inv-slots");
    el.innerHTML = "";
    const ids = Object.keys(G.inv);
    const total = Math.max(CFG.invSlots, ids.length);
    for (let i = 0; i < total; i++) {
        const id = ids[i];
        const div = document.createElement("div");
        div.className = "slot";
        if (id) {
            const it = ITEMS[id];
            div.innerHTML = `<span>${it.icon}</span><span class="qty">${G.inv[id]}</span><span class="keyhint">${i + 1}</span>`;
            if (G.equipped === id) div.classList.add("equipped");
            div.title = it.name;
            div.addEventListener("click", () => itemClick(id));
        }
        el.appendChild(div);
    }
    // подсветка экипированного, если он есть, но не в первых слотах
}

function renderCraft() {
    const list = document.getElementById("craft-list");
    list.innerHTML = "";
    for (const r of RECIPES) {
        const it = ITEMS[r.out];
        const can = hasCost(r.cost);
        const row = document.createElement("div");
        row.className = "recipe" + (can ? " can" : "");
        const costHtml = Object.keys(r.cost).map(k => {
            const ok = countItem(k) >= r.cost[k];
            return `<span class="${ok ? "ok" : "no"}">${ITEMS[k].icon}${countItem(k)}/${r.cost[k]}</span>`;
        }).join(" ");
        row.innerHTML =
            `<div class="recipe-ico">${it.icon}</div>` +
            `<div class="recipe-info"><div class="recipe-name">${it.name}</div>` +
            `<div class="recipe-cost">${costHtml}</div></div>` +
            `<button class="recipe-btn" ${can ? "" : "disabled"}>Создать</button>`;
        row.querySelector("button").addEventListener("click", () => craft(r));
        list.appendChild(row);
    }
}
function toggleCraft() {
    const p = document.getElementById("craft-panel");
    p.classList.toggle("hidden");
    if (!p.classList.contains("hidden")) renderCraft();
}

/* ---------------------------------------------------------------------
   22. ТУЛТИП ПОД КУРСОРОМ
   --------------------------------------------------------------------- */
function updateTooltip() {
    const tt = document.getElementById("tooltip");
    // курсор в мировых координатах
    const wx = G.mouse.x - W / 2 + G.camX;
    const wy = G.mouse.y - H / 2 + G.camY;

    let title = "", sub = "";
    // ближайшая цель под курсором
    let best = null, bd = 60;
    for (const c of G.creatures) {
        const d = dist(wx, wy, c.x, c.y);
        if (d < c.r + 14 && d < bd) { bd = d; best = { c }; }
    }
    if (best) {
        const def = CREATURE_TYPES[best.c.type];
        title = (def.boss ? "👑 " : "") + def.name;
        const hpPct = Math.ceil(best.c.hp / best.c.maxHp * 100);
        sub = `HP ${Math.ceil(best.c.hp)}/${best.c.maxHp} · ${def.passive ? "пассивное" : "враждебное"} · ЛКМ — удар`;
    } else {
        let nBest = null, nd = 60;
        for (const n of G.nodes) {
            const d = dist(wx, wy, n.x, n.y);
            if (d < n.r + 10 && d < nd) { nd = d; nBest = n; }
        }
        if (nBest) {
            const def = NODE_TYPES[nBest.type];
            title = def.name;
            sub = (def.tool ? (def.tool === "axe" ? "Нужен топор" : "Нужна кирка") : "ЛКМ — собрать") +
                  (nBest.hp < nBest.maxHp ? ` · Прочность ${nBest.hp}/${nBest.maxHp}` : "");
        } else {
            // рядом с костром?
            for (const s of G.structures) {
                if (s.type === "campfire" && dist(G.px, G.py, s.x, s.y) < CFG.gatherRange + 30) {
                    title = "Костёр";
                    sub = countItem("meat") > 0 ? "ЛКМ — приготовить мясо" : "Даёт свет и рассудок ночью";
                    break;
                }
            }
        }
    }

    if (title) {
        tt.classList.remove("hidden");
        tt.innerHTML = `<div class="tt-name">${title}</div><div class="tt-sub">${sub}</div>`;
        tt.style.left = (G.mouse.x + 16) + "px";
        tt.style.top = (G.mouse.y + 16) + "px";
    } else {
        tt.classList.add("hidden");
    }
}

/* ---------------------------------------------------------------------
   23. РЕНДЕР
   --------------------------------------------------------------------- */
function worldToScreen(x, y) {
    return [x - G.camX + W / 2, y - G.camY + H / 2];
}

function draw() {
    const night = nightFactor();

    // ---- фон мира ----
    ctx.fillStyle = "#101a12";
    ctx.fillRect(0, 0, W, H);

    // травяной паттерн (сетка пятен)
    const grid = 160;
    const startX = Math.floor((G.camX - W / 2) / grid) * grid;
    const startY = Math.floor((G.camY - H / 2) / grid) * grid;
    for (let gx = startX; gx < G.camX + W / 2 + grid; gx += grid) {
        for (let gy = startY; gy < G.camY + H / 2 + grid; gy += grid) {
            const [sx, sy] = worldToScreen(gx, gy);
            // детерминированный pseudo-random по координатам
            const h = Math.abs(Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453) % 1;
            ctx.fillStyle = h < 0.5 ? "#16241a" : "#131f16";
            ctx.fillRect(sx, sy, grid, grid);
            if (h > 0.82) {
                ctx.fillStyle = "#1b2f1f";
                ctx.beginPath();
                ctx.arc(sx + (h * 100) % grid, sy + (h * 70) % grid, 14, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // границы мира
    const [wx0, wy0] = worldToScreen(0, 0);
    ctx.strokeStyle = "#2a1a1a";
    ctx.lineWidth = 8;
    ctx.strokeRect(wx0, wy0, CFG.worldW, CFG.worldH);

    // ---- тени ----
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    const shadowables = [];
    for (const n of G.nodes) shadowables.push({ x: n.x, y: n.y, r: n.r * 0.9, k: n.r });
    for (const c of G.creatures) shadowables.push({ x: c.x, y: c.y, r: c.r * 0.9, k: c.r });
    shadowables.push({ x: G.px, y: G.py, r: 16, k: 18 });
    for (const s of G.structures) shadowables.push({ x: s.x, y: s.y, r: 24, k: 26 });
    for (const s of shadowables) {
        const [sx, sy] = worldToScreen(s.x, s.y + s.k * 0.55);
        if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
        ctx.beginPath();
        ctx.ellipse(sx, sy, s.r, s.r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // ---- постройки ----
    for (const s of G.structures) {
        const [sx, sy] = worldToScreen(s.x, s.y);
        if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) continue;
        if (s.type === "campfire") {
            // костёр
            ctx.fillStyle = "#3b2a1c";
            ctx.beginPath(); ctx.arc(sx, sy, 24, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#5a4028";
            ctx.fillRect(sx - 16, sy - 5, 32, 8);
            // пламя
            const fl = 0.7 + Math.sin(G.time * 9) * 0.3;
            ctx.fillStyle = "#ff8c1a";
            ctx.beginPath();
            ctx.moveTo(sx - 10, sy);
            ctx.quadraticCurveTo(sx, sy - 30 * fl, sx + 10, sy);
            ctx.fill();
            ctx.fillStyle = "#ffd23f";
            ctx.beginPath();
            ctx.moveTo(sx - 5, sy);
            ctx.quadraticCurveTo(sx, sy - 17 * fl, sx + 5, sy);
            ctx.fill();
        }
    }

    // ---- ресурсы (сортировка по y для псевдо-3D) ----
    const drawable = [];
    for (const n of G.nodes) drawable.push({ y: n.y, kind: "node", o: n });
    for (const c of G.creatures) drawable.push({ y: c.y, kind: "creature", o: c });
    drawable.push({ y: G.py, kind: "player", o: null });
    drawable.sort((a, b) => a.y - b.y);

    for (const d of drawable) {
        if (d.kind === "node") drawNode(d.o);
        else if (d.kind === "creature") drawCreature(d.o);
        else drawPlayer();
    }

    // ---- частицы ----
    for (const p of G.particles) {
        const [sx, sy] = worldToScreen(p.x, p.y);
        ctx.globalAlpha = 1 - p.t / p.life;
        ctx.fillStyle = p.col;
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
        ctx.globalAlpha = 1;
    }

    // ---- всплывающий текст ----
    ctx.textAlign = "center";
    ctx.font = "bold 15px Segoe UI";
    for (const f of G.floaters) {
        const [sx, sy] = worldToScreen(f.x, f.y);
        ctx.globalAlpha = clamp(1 - f.t / f.life, 0, 1);
        ctx.fillStyle = "#000";
        ctx.fillText(f.text, sx + 1, sy + 1);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, sx, sy);
        ctx.globalAlpha = 1;
    }

    // ---- подсветка ближайшей цели ----
    const aimWx = G.mouse.x - W / 2 + G.camX;
    const aimWy = G.mouse.y - H / 2 + G.camY;
    drawAim(aimWx, aimWy);

    // ---- затемнение ночи ----
    if (night > 0.01) {
        ctx.fillStyle = `rgba(6, 6, 20, ${night * 0.78})`;
        ctx.fillRect(0, 0, W, H);
        // дырка света от игрока/факела/костра
        drawLightHole(G.px, G.py, equippedLightRadius(), night);
        for (const s of G.structures) {
            if (s.type === "campfire") drawLightHole(s.x, s.y, 260, night);
        }
    }

    // ---- виньетка ----
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // ---- урон ----
    if (G.hurtFlash > 0) {
        ctx.fillStyle = `rgba(200, 0, 0, ${G.hurtFlash * 0.32})`;
        ctx.fillRect(0, 0, W, H);
    }

    // ---- низкий рассудок — помехи ----
    const sanLow = 1 - G.sanity / 100;
    if (sanLow > 0.55) {
        const alpha = (sanLow - 0.55) / 0.45 * 0.22;
        ctx.globalAlpha = alpha;
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = Math.random() < 0.5 ? "#000" : "#3a1030";
            ctx.fillRect(Math.random() * W, Math.random() * H, rnd(2, 60), rnd(1, 3));
        }
        ctx.globalAlpha = 1;
    }
}

function equippedLightRadius() {
    if (G.equipped && ITEMS[G.equipped].light) return ITEMS[G.equipped].light;
    return 95;
}
function drawLightHole(wx, wy, radius, night) {
    const [sx, sy] = worldToScreen(wx, wy);
    const grd = ctx.createRadialGradient(sx, sy, radius * 0.15, sx, sy, radius);
    grd.addColorStop(0, `rgba(0,0,0,${night * 0.78})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // вырезаем darkness: рисуем прозрачный градиент поверх (свет)
    ctx.globalCompositeOperation = "destination-out";
    const g2 = ctx.createRadialGradient(sx, sy, radius * 0.2, sx, sy, radius);
    g2.addColorStop(0, `rgba(0,0,0,${night * 0.9})`);
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // тёплый отсвет
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const warm = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    warm.addColorStop(0, `rgba(255,170,60,${night * 0.14})`);
    warm.addColorStop(1, "rgba(255,170,60,0)");
    ctx.fillStyle = warm;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawAim(wx, wy) {
    const c = nearestCreature(CFG.attackRange);
    const n = c ? null : nearestNode(CFG.gatherRange);
    let target = null;
    if (c) target = { x: c.x, y: c.y, r: c.r };
    else if (n) target = { x: n.x, y: n.y, r: n.r };
    if (!target) return;
    const [sx, sy] = worldToScreen(target.x, target.y);
    const [ax, ay] = worldToScreen(wx, wy);
    // подсветка кольцом
    ctx.strokeStyle = c ? "rgba(255,80,80,0.85)" : "rgba(241,196,15,0.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(sx, sy, target.r + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // прицел
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(ax, ay, 7, 0, Math.PI * 2);
    ctx.stroke();
}

function drawNode(n) {
    const [sx, sy] = worldToScreen(n.x, n.y);
    if (sx < -80 || sx > W + 80 || sy < -100 || sy > H + 80) return;
    const def = NODE_TYPES[n.type];
    const shake = n.shake > 0 ? Math.sin(G.time * 40) * n.shake * 4 : 0;
    const sway = Math.sin(G.time * 1.5 + n.wobble) * 2;
    const x = sx + shake;

    ctx.save();
    if (n.shake > 0) ctx.translate(x, sy);

    if (n.type === "tree" || n.type === "deadTree") {
        // ствол
        ctx.fillStyle = n.type === "tree" ? "#4a3524" : "#5c4a32";
        ctx.fillRect(x - 6, sy - 10, 12, 34);
        // крона
        if (n.type === "tree") {
            ctx.fillStyle = "#2f6b3a";
            ctx.beginPath();
            ctx.arc(x + sway, sy - 30, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#3d8449";
            ctx.beginPath();
            ctx.arc(x + sway - 8, sy - 38, 18, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // сухое дерево — ветви
            ctx.strokeStyle = "#5c4a32";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(x, sy);
            ctx.lineTo(x, sy - 34);
            ctx.moveTo(x, sy - 20); ctx.lineTo(x - 16, sy - 38);
            ctx.moveTo(x, sy - 24); ctx.lineTo(x + 15, sy - 44);
            ctx.stroke();
        }
    } else if (n.type === "boulder") {
        ctx.fillStyle = "#6f6f78";
        ctx.beginPath();
        ctx.moveTo(x - 24, sy + 8);
        ctx.lineTo(x - 16, sy - 16);
        ctx.lineTo(x + 4, sy - 22);
        ctx.lineTo(x + 22, sy - 8);
        ctx.lineTo(x + 24, sy + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#84848f";
        ctx.beginPath();
        ctx.moveTo(x - 12, sy - 4);
        ctx.lineTo(x - 4, sy - 16);
        ctx.lineTo(x + 10, sy - 12);
        ctx.lineTo(x + 6, sy + 2);
        ctx.closePath();
        ctx.fill();
    } else if (n.type === "berryBush") {
        ctx.fillStyle = "#26512f";
        ctx.beginPath(); ctx.arc(x, sy, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#7b2d5e";
        const pts = [[-8, -6], [6, -10], [10, 4], [-4, 8], [-12, 2]];
        for (const [ox, oy] of pts) { ctx.beginPath(); ctx.arc(x + ox, sy + oy, 3.5, 0, Math.PI * 2); ctx.fill(); }
    } else if (n.type === "grassTuft") {
        ctx.strokeStyle = "#4e9c3f";
        ctx.lineWidth = 3;
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(x + i * 5, sy + 8);
            ctx.quadraticCurveTo(x + i * 6 + sway, sy - 4, x + i * 7, sy - 14);
            ctx.stroke();
        }
    } else if (n.type === "flintRock") {
        ctx.fillStyle = "#5a5170";
        ctx.beginPath();
        ctx.moveTo(x - 12, sy + 6); ctx.lineTo(x - 4, sy - 12);
        ctx.lineTo(x + 10, sy - 6); ctx.lineTo(x + 8, sy + 8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#7a6f96";
        ctx.fillRect(x - 2, sy - 6, 5, 5);
    } else if (n.type === "twigBush") {
        ctx.strokeStyle = "#8a6b3a";
        ctx.lineWidth = 3;
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(x + i * 4, sy + 8);
            ctx.lineTo(x + i * 6, sy - 10 - Math.abs(i) * 3);
            ctx.stroke();
        }
    } else if (n.type === "mushroom") {
        ctx.fillStyle = "#e0d6c2";
        ctx.fillRect(x - 3, sy - 4, 6, 12);
        ctx.fillStyle = "#c9a227";
        ctx.beginPath();
        ctx.ellipse(x, sy - 4, 12, 9, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(x - 4, sy - 8, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 5, sy - 6, 2, 0, Math.PI * 2); ctx.fill();
    }

    // полоса прочности, если повреждён
    if (n.hp < n.maxHp) {
        const w = n.r * 1.6;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x - w / 2, sy - n.r - 24, w, 5);
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(x - w / 2, sy - n.r - 24, w * (n.hp / n.maxHp), 5);
    }
    ctx.restore();
    n.shake = Math.max(0, n.shake - 0.08);
}

function drawCreature(c) {
    const [sx, sy] = worldToScreen(c.x, c.y);
    if (sx < -90 || sx > W + 90 || sy < -90 || sy > H + 90) return;
    const def = CREATURE_TYPES[c.type];
    const bob = Math.sin(c.anim) * 3;
    const r = c.r;

    ctx.save();
    if (c.hitFlash > 0) {
        ctx.globalAlpha = 1;
        ctx.filter = "brightness(1.6)";
    }

    if (c.type === "rabbit") {
        ctx.fillStyle = def.col;
        ctx.beginPath(); ctx.ellipse(sx, sy + bob, r, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sx + 4, sy - r + bob, 4, 9, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sx - 2, sy - r + bob, 4, 9, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222";
        ctx.beginPath(); ctx.arc(sx + 5, sy - 2 + bob, 1.6, 0, Math.PI * 2); ctx.fill();
    } else if (c.type === "deer") {
        ctx.fillStyle = def.col;
        ctx.beginPath(); ctx.ellipse(sx, sy + bob, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8a6234";
        ctx.beginPath(); ctx.arc(sx + 12, sy - r * 0.7 + bob, r * 0.45, 0, Math.PI * 2); ctx.fill();
        // рога
        ctx.strokeStyle = "#d8c9a3"; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx + 12, sy - r * 0.9 + bob); ctx.lineTo(sx + 18, sy - r * 1.5 + bob);
        ctx.moveTo(sx + 8, sy - r * 0.9 + bob); ctx.lineTo(sx + 4, sy - r * 1.5 + bob);
        ctx.stroke();
        ctx.fillStyle = "#111";
        ctx.beginPath(); ctx.arc(sx + 15, sy - r * 0.7 + bob, 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (c.type === "boar") {
        ctx.fillStyle = def.col;
        ctx.beginPath(); ctx.ellipse(sx, sy + bob, r, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#4e3529";
        ctx.beginPath(); ctx.arc(sx + r * 0.7, sy - 2 + bob, r * 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#eee"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx + r * 0.9, sy + 2 + bob); ctx.lineTo(sx + r * 1.2, sy - 4 + bob);
        ctx.stroke();
        ctx.fillStyle = "#c0392b";
        ctx.beginPath(); ctx.arc(sx + r * 0.75, sy - 3 + bob, 2, 0, Math.PI * 2); ctx.fill();
    } else if (c.type === "spider") {
        ctx.strokeStyle = "#241533"; ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i += 2) {
            for (let l = 0; l < 4; l++) {
                const a = -0.9 + l * 0.6;
                const leg = Math.sin(c.anim + l) * 4;
                ctx.beginPath();
                ctx.moveTo(sx, sy + bob);
                ctx.lineTo(sx + Math.cos(a) * (r + 14) * i, sy + Math.sin(a) * (r + 10) + leg + bob);
                ctx.stroke();
            }
        }
        ctx.fillStyle = def.col;
        ctx.beginPath(); ctx.ellipse(sx, sy + bob, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8e24aa";
        ctx.beginPath(); ctx.arc(sx - 4, sy - 3 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + 4, sy - 3 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (c.type === "wolf") {
        ctx.fillStyle = def.col;
        ctx.beginPath(); ctx.ellipse(sx, sy + bob, r, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.65, sy - r * 0.35 + bob, r * 0.48, 0, Math.PI * 2); ctx.fill();
        // уши
        ctx.fillStyle = "#3d454e";
        ctx.beginPath();
        ctx.moveTo(sx + r * 0.5, sy - r * 0.7 + bob); ctx.lineTo(sx + r * 0.65, sy - r * 1.15 + bob); ctx.lineTo(sx + r * 0.8, sy - r * 0.7 + bob);
        ctx.fill();
        ctx.fillStyle = "#e74c3c";
        ctx.beginPath(); ctx.arc(sx + r * 0.8, sy - r * 0.4 + bob, 2.4, 0, Math.PI * 2); ctx.fill();
        // хвост
        ctx.strokeStyle = def.col; ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.8, sy + bob);
        ctx.quadraticCurveTo(sx - r * 1.5, sy - 8 + bob, sx - r * 1.9, sy + 4 + bob);
        ctx.stroke();
    } else if (c.type === "golem") {
        // тело-камни
        ctx.fillStyle = def.col;
        ctx.beginPath();
        ctx.moveTo(sx - r, sy + r * 0.6);
        ctx.lineTo(sx - r * 0.8, sy - r * 0.5);
        ctx.lineTo(sx, sy - r);
        ctx.lineTo(sx + r * 0.8, sy - r * 0.5);
        ctx.lineTo(sx + r, sy + r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#82828f";
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.5, sy);
        ctx.lineTo(sx - r * 0.2, sy - r * 0.6);
        ctx.lineTo(sx + r * 0.4, sy - r * 0.3);
        ctx.lineTo(sx + r * 0.2, sy + r * 0.3);
        ctx.closePath();
        ctx.fill();
        // глаза
        const pulse = 0.6 + Math.sin(G.time * 4) * 0.4;
        ctx.fillStyle = `rgba(255, 80, 40, ${pulse})`;
        ctx.beginPath(); ctx.arc(sx - r * 0.3, sy - r * 0.3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.3, sy - r * 0.3, 5, 0, Math.PI * 2); ctx.fill();
        // руки
        ctx.fillStyle = "#5c5c66";
        ctx.fillRect(sx - r - 10, sy - 6, 16, 34);
        ctx.fillRect(sx + r - 6, sy - 6, 16, 34);
    } else if (c.type === "shade") {
        // теневой зверь — дымчатый
        ctx.save();
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = def.col;
        ctx.beginPath(); ctx.ellipse(sx, sy + bob, r * 1.2, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.8, sy - r * 0.3 + bob, r * 0.55, 0, Math.PI * 2); ctx.fill();
        // дым
        for (let i = 0; i < 5; i++) {
            const a = G.time * 2 + i * 1.3;
            ctx.fillStyle = `rgba(80, 30, 130, ${0.25 + Math.sin(a) * 0.15})`;
            ctx.beginPath();
            ctx.arc(sx + Math.cos(a) * r, sy + Math.sin(a * 1.3) * r * 0.5 + bob, r * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = "#b388ff";
        ctx.beginPath(); ctx.arc(sx + r * 0.6, sy - r * 0.4 + bob, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 1.0, sy - r * 0.4 + bob, 4, 0, Math.PI * 2); ctx.fill();
        // когти
        ctx.strokeStyle = "#7c4dff"; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(sx - r * 0.5 + i * 8, sy + r * 0.5);
            ctx.lineTo(sx - r * 0.7 + i * 8, sy + r * 0.95);
            ctx.stroke();
        }
    }

    ctx.filter = "none";

    // полоса HP
    if (c.hp < c.maxHp || def.boss) {
        const w = Math.max(r * 2, 40);
        const y = sy - r - (def.boss ? 26 : 16);
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(sx - w / 2, y, w, def.boss ? 8 : 6);
        ctx.fillStyle = def.boss ? "#e74c3c" : "#e67e22";
        ctx.fillRect(sx - w / 2, y, w * clamp(c.hp / c.maxHp, 0, 1), def.boss ? 8 : 6);
        if (def.boss) {
            ctx.fillStyle = "#f1c40f";
            ctx.font = "bold 12px Segoe UI";
            ctx.textAlign = "center";
            ctx.fillText("👑 " + def.name, sx, y - 6);
        }
    }
    ctx.restore();
}

function drawPlayer() {
    const [sx, sy] = worldToScreen(G.px, G.py);
    const walk = (G.keys["up"] || G.keys["left"] || G.keys["down"] || G.keys["right"]) ? Math.sin(G.time * 14) * 3 : 0;

    // тело
    ctx.fillStyle = "#c94f4f";
    ctx.beginPath();
    ctx.ellipse(sx, sy + walk * 0.3, 17, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // рубашка
    ctx.fillStyle = "#8e2f2f";
    ctx.beginPath();
    ctx.ellipse(sx, sy + 8 + walk * 0.3, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // голова
    ctx.fillStyle = "#f0c8a0";
    ctx.beginPath(); ctx.arc(sx, sy - 20 + walk * 0.3, 13, 0, Math.PI * 2); ctx.fill();
    // волосы
    ctx.fillStyle = "#3a2a1a";
    ctx.beginPath(); ctx.arc(sx, sy - 24 + walk * 0.3, 13, Math.PI, 0); ctx.fill();
    // глаза в направлении взгляда
    const ex = Math.cos(G.facing) * 4;
    const ey = Math.sin(G.facing) * 2;
    ctx.fillStyle = "#222";
    ctx.beginPath(); ctx.arc(sx - 4 + ex, sy - 19 + ey, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 4 + ex, sy - 19 + ey, 2, 0, Math.PI * 2); ctx.fill();

    // экипированное в руке
    if (G.equipped) {
        const it = ITEMS[G.equipped];
        const hx = sx + Math.cos(G.facing) * 24;
        const hy = sy + Math.sin(G.facing) * 16 + 2;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(G.facing + 0.6);
        ctx.font = "20px Segoe UI Emoji";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(it.icon, 0, 0);
        ctx.restore();
    }

    // рывок — шлейф
    if (G.dashT > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, 26, 0, Math.PI * 2);
        ctx.stroke();
    }
}

/* ---------------------------------------------------------------------
   24. HUD (статы, часы)
   --------------------------------------------------------------------- */
function renderHud() {
    document.getElementById("bar-hp").style.width = (G.hp / G.maxHp * 100) + "%";
    document.getElementById("bar-hunger").style.width = G.hunger + "%";
    document.getElementById("bar-sanity").style.width = G.sanity + "%";
    document.getElementById("num-hp").textContent = Math.ceil(G.hp);
    document.getElementById("num-hunger").textContent = Math.ceil(G.hunger);
    document.getElementById("num-sanity").textContent = Math.ceil(G.sanity);

    const info = phaseInfo();
    const p = G.dayPhase;
    let ico, phase;
    if (p < 0.15) { ico = "🌅"; phase = "Рассвет"; }
    else if (p < CFG.nightStart - 0.15) { ico = "☀️"; phase = "День"; }
    else if (p < CFG.nightStart) { ico = "🌇"; phase = "Закат"; }
    else if (p < CFG.dawnStart) { ico = "🌙"; phase = "Ночь"; }
    else { ico = "🌅"; phase = "Рассвет"; }
    document.getElementById("clock-ico").textContent = ico;
    document.getElementById("clock-day").textContent = "День " + G.day;
    document.getElementById("clock-phase").textContent = phase;
}

/* ---------------------------------------------------------------------
   25. СМЕРТЬ
   --------------------------------------------------------------------- */
function die(reason) {
    if (!G.running) return;
    G.running = false;
    G.deathReason = reason;
    document.getElementById("death-reason").textContent = reason;
    document.getElementById("death-stats").textContent =
        "Продержались: " + G.day + " " + plural(G.day, "день", "дня", "дней") +
        " · Собрано: " + Object.keys(G.inv).length + " типов ресурсов";
    document.getElementById("death-screen").classList.remove("hidden");
}
function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}

/* ---------------------------------------------------------------------
   26. ГЛАВНЫЙ ЦИКЛ
   --------------------------------------------------------------------- */
let lastT = performance.now();
function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!G.running) { draw(); return; }
    if (G.paused) { draw(); return; }   // пауза: рендерим, но логика стоит

    G.time += dt;
    G.dayPhase += dt / CFG.dayLength;
    if (G.dayPhase >= 1) { G.dayPhase -= 1; G.day++; toast("🌅 Наступил день " + G.day, "#f1c40f"); }

    updatePlayer(dt);
    updateStats(dt);
    updateCreatures(dt);
    updateSpawns(dt);
    respawnNodes(dt);

    // частицы
    for (const p of G.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; }
    G.particles = G.particles.filter(p => p.t < p.life);
    for (const f of G.floaters) { f.t += dt; f.y += f.vy * dt; }
    G.floaters = G.floaters.filter(f => f.t < f.life);

    G.hurtFlash = Math.max(0, G.hurtFlash - dt * 2);
    G.shake = Math.max(0, G.shake - dt * 30);

    // камера — плавно за игроком (+ тряска)
    const tx = G.px, ty = G.py;
    G.camX += (tx - G.camX) * Math.min(1, dt * 6);
    G.camY += (ty - G.camY) * Math.min(1, dt * 6);
    const shakeX = rnd(-G.shake, G.shake), shakeY = rnd(-G.shake, G.shake);
    const oldCamX = G.camX, oldCamY = G.camY;
    G.camX += shakeX; G.camY += shakeY;

    updateTooltip();
    renderHud();
    draw();

    G.camX = oldCamX; G.camY = oldCamY;
}

/* ---------------------------------------------------------------------
   27. СТАРТ ИГРЫ
   --------------------------------------------------------------------- */
function startGame() {
    G.running = true;
    G.paused = false;
    G.keys = {};
    document.getElementById("pause-screen").classList.add("hidden");
    G.time = 0; G.day = 1; G.dayPhase = 0.05;
    G.hp = G.maxHp = 100; G.hunger = 100; G.sanity = 100;
    G.px = CFG.worldW / 2; G.py = CFG.worldH / 2;
    G.camX = G.px; G.camY = G.py;
    G.inv = {}; G.equipped = null;
    G.creatures = []; G.structures = []; G.particles = []; G.floaters = [];
    G.spawnTimer = 1; G.bossTimer = 0;
    G.dashT = 0; G.dashCd = 0; G.gatherCd = 0;
    generateWorld();
    // несколько кроликов на старте
    for (let i = 0; i < 3; i++) {
        const a = rnd(0, Math.PI * 2);
        spawnCreature("rabbit", G.px + Math.cos(a) * rnd(250, 400), G.py + Math.sin(a) * rnd(250, 400));
    }
    // стартовый набор
    addItem("twig", 3); addItem("flint", 1);
    renderInventory();
    renderCraft();
    toast("Добро пожаловать! Соберите ресурсы и переживите первую ночь.", "#f1c40f");
}

document.getElementById("btn-start").addEventListener("click", () => {
    document.getElementById("start-screen").classList.add("hidden");
    document.getElementById("btn-craft-toggle").classList.remove("hidden");
    startGame();
});
document.getElementById("btn-restart").addEventListener("click", () => {
    document.getElementById("death-screen").classList.add("hidden");
    startGame();
});
document.getElementById("btn-resume").addEventListener("click", togglePause);
document.getElementById("craft-close").addEventListener("click", toggleCraft);
document.getElementById("btn-craft-toggle").addEventListener("click", toggleCraft);

setupInput();
renderInventory();
requestAnimationFrame(loop);

/* Отладочный хук */
window.GameDebug = { G, startGame, spawnBoss, spawnCreature, addItem, NODE_TYPES, CREATURE_TYPES };