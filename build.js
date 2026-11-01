/* =====================================================================
   СБОРКА ПРОЕКТА → dist/index.html
   Инлайнит style.css и game.js внутрь index.html, получая один
   самодостаточный файл (можно открыть напрямую / залить на хостинг).

   Запуск:  node build.js
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const root = __dirname;
const distDir = path.join(root, "dist");

function read(file) {
    return fs.readFileSync(path.join(root, file), "utf8");
}

/* Экранирование, чтобы содержимое не разорвало HTML-теги */
function safeCss(css) {
    // внутри <style> последовательность </style> закончит блок
    return css.replace(/<\/style/gi, "<\\/style");
}
function safeJs(js) {
    // внутри <script> последовательность </script> закончит блок
    return js.replace(/<\/script/gi, "<\\/script");
}

const html = read("index.html");
const css = read("css/style.css");
const js = read("js/game.js");

let out = html;

/* 1. CSS: <link ... href="css/style.css">  →  <style>...</style> */
const cssLink = /<link\s+rel="stylesheet"\s+href="css\/style\.css"\s*\/?>/i;
if (cssLink.test(out)) {
    out = out.replace(cssLink, "<style>\n" + safeCss(css) + "\n</style>");
} else if (/<style>[\s\S]*?<\/style>/i.test(out)) {
    // уже есть style-блок (повторная сборка) — заменяем содержимое
    out = out.replace(/<style>[\s\S]*?<\/style>/i, "<style>\n" + safeCss(css) + "\n</style>");
} else {
    throw new Error("Не найден link на css/style.css для инлайна");
}

/* 2. JS: <script src="js/game.js"></script>  →  <script>...</script> */
const jsTag = /<script\s+src="js\/game\.js"\s*><\/script>/i;
if (jsTag.test(out)) {
    out = out.replace(jsTag, "<script>\n" + safeJs(js) + "\n</script>");
} else if (/<script>[\s\S]*?<\/script>/i.test(out)) {
    out = out.replace(/<script>[\s\S]*?<\/script>/i, "<script>\n" + safeJs(js) + "\n</script>");
} else {
    throw new Error("Не найден script src=js/game.js для инлайна");
}

/* 3. Проверка: не осталось ли внешних ссылок на наши файлы */
const leaked = out.match(/(?:href|src)="(?:css\/style\.css|js\/game\.js)"/i);
if (leaked) throw new Error("В сборке остались внешние ссылки: " + leaked[0]);

/* Запись */
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
const outFile = path.join(distDir, "index.html");
fs.writeFileSync(outFile, out, "utf8");

/* Отчёт */
const kb = n => (Buffer.byteLength(n, "utf8") / 1024).toFixed(1) + " KB";
console.log("Сборка завершена:");
console.log("  вход:  index.html + style.css (" + kb(css) + ") + game.js (" + kb(js) + ")");
console.log("  выход: dist/index.html (" + kb(out) + ")");
console.log("Файл самодостаточный — открывайте dist/index.html напрямую.");