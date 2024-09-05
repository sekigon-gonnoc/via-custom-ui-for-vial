import fs from "fs";
import fetch from "node-fetch";
import path from "path";

const outputFilePath = "public/keycodes";
const version = "0.0.3";

const [keycodes, range] = await fetch(
  `https://keyboards.qmk.fm/v1/constants/keycodes_${version}.json`,
  { method: "Get" },
)
  .then((res) => res.json())
  .then((json) => {
    const keycodes = Object.entries(json.keycodes).reduce((kt, kc) => {
      kt[parseInt(kc[0])] = kc[1];
      return kt;
    }, {});
    const range = Object.entries(json.ranges).reduce((acc, cur) => {
      acc[cur[1].define] = {
        start: Number(cur[0].split("/")[0]),
        end: Number(cur[0].split("/")[0]) + Number(cur[0].split("/")[1]),
      };
      return acc;
    }, {});
    return [keycodes, range];
  });

fs.writeFileSync(
  path.join(outputFilePath, version, "keycodes.json"),
  JSON.stringify(keycodes, null, 2),
);
fs.writeFileSync(
  path.join(outputFilePath, version, "quantum_keycode_range.json"),
  JSON.stringify(range, null, 2),
);
