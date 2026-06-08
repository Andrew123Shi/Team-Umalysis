import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pako from "pako";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const inputPath = path.join(root, "public", "data", "gamedata.bin.gz");
const assetsDir = path.join(root, ".gamedata-assets");

const compressed = fs.readFileSync(inputPath);
const json = JSON.parse(pako.inflate(compressed, { to: "string" }));

fs.mkdirSync(assetsDir, { recursive: true });
for (const [key, value] of Object.entries(json)) {
    const filePath = path.join(assetsDir, `${key}.json`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    console.log(`  Wrote ${path.relative(root, filePath)}`);
}

console.log(`Extracted ${Object.keys(json).length} sections to ${assetsDir}`);
