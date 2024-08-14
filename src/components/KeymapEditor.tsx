import { match, P } from "ts-pattern";

export interface KeymapProperties {
  layouts: {
    labels?: string[][];
    keymap:
      | (
          | string
          | { x?: number; y?: number; r?:number, rx?: number; ry?: number; w?: number, h?:number }
        )[][];
    customKeycodes?:
      | { name: string; title: string; shortName: string }[];
  };
}

interface KeymapKeyProperties {
  matrix: number[];
  x: number;
  y: number;
  offsetx: number;
  offsety: number;
  r: number;
  rx: number;
  ry: number;
  w: number;
  h: number;
  layout: number[];
}

export function KeymapKey(props: KeymapKeyProperties) {
  const WIDTH_1U = 50;
  return (
    <div
      style={
        props.r != 0
          ? {
              position: "fixed",
              top: (props.ry + props.offsety) * WIDTH_1U,
              left: (props.rx + props.offsetx) * WIDTH_1U,
              width: props.w * WIDTH_1U - 3,
              height: props.h * WIDTH_1U - 3,
              outline: "solid",
              outlineWidth: "1px",
              outlineColor: "black",
              transform: `rotate(${props.r}deg)`,
              transformOrigin: `${-props.offsetx * WIDTH_1U}px ${-props.offsety * WIDTH_1U}px`,
            }
          : {
              position: "fixed",
              top: props.y * WIDTH_1U,
              left: props.x * WIDTH_1U,
              width: props.w * WIDTH_1U - 3,
              height: props.h * WIDTH_1U - 3,
              outline: "solid",
              outlineWidth: "1px",
              outlineColor: "black",
            }
      }
    ></div>
  );
}

function convertToKeymapKeys(
  keymap: KeymapProperties,
  layoutOptions: { [layout: number]: number }
): KeymapKeyProperties[] {
  let current = {
    x: 0,
    y: 0,
    offsetx: 0,
    offsety: 0,
    r: 0,
    rx: 0,
    ry: 0,
    w: 1,
    h: 1,
  };
  const keys: KeymapKeyProperties[] = [];
  for (const row of keymap.layouts.keymap) {
    for (const col of row) {
      match(col)
        .with(P.string, (col) => {
          const layout = col
            .split("\n")[3]
            ?.split(",")
            ?.map((s) => parseInt(s));
          if (layoutOptions[layout[0]]==layout[1])
          {
            keys.push({
              ...current,
              matrix: col
                .split("\n")[0]
                .split(",")
                .map((v) => parseInt(v))
                .slice(2),
              layout: [],
            });
            current.x += 1;
          }
        })
        .with(P._, (col) => {
          current = {
            ...current,
            ...col,
            x: current.x + (col.r ? 0 : col.x ?? 0),
            y: current.y + (col.r ? 0 : col.y ?? 0),
            offsetx: col.r ? col.x ?? 0 : 0,
            offsety: col.r ? col.y ?? 0 : 0,
          };
        });
    }
    current.x = 0;
    current.y += 1;
    current.y = current.r ? 0 : current.y;
  }
  return keys;
}

export function KeymapEditor(props: KeymapProperties) {
  return (
    <div style={{ contain: "layout", marginTop: 50 }}>
      {convertToKeymapKeys(props, { 0: 2 }).map((p) => KeymapKey(p))}
    </div>
  );
}