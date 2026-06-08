import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fromJson, toBinary } from "@bufbuild/protobuf";
import pako from "pako";
import { UMDatabaseSchema } from "../../src/data/data_pb.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const inputPath = path.join(root, "public", "data", "umdb.json");
const outputPath = path.join(root, "public", "data", "umdb.binarypb.gz");

const json = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const message = fromJson(UMDatabaseSchema, json);
const binary = toBinary(UMDatabaseSchema, message);
const compressed = pako.gzip(binary);

fs.writeFileSync(outputPath, compressed);
console.log(`Wrote ${outputPath} (${compressed.length.toLocaleString()} bytes)`);
