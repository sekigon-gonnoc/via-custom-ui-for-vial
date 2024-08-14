import { Button, FormControl, MenuItem, Select } from "@mui/material";
import { match, P } from "ts-pattern";
import { ViaKeyboard } from "../services/vialKeyboad";
import { useEffect, useState } from "react";
import { convertIntToKeycode, QmkKeycode } from "./keycodes/keycodeConverter";

export interface KeymapProperties {
  via: ViaKeyboard;
  matrix: { rows: number; cols: number };
  layouts: {
    labels?: string[][];
    keymap:
      | (
          | string
          | {
              x?: number;
              y?: number;
              r?: number;
              rx?: number;
              ry?: number;
              w?: number;
              h?: number;
            }
        )[][];
    customKeycodes?: { name: string; title: string; shortName: string }[];
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
  keycode: QmkKeycode;
}

export function KeymapKey(props: KeymapKeyProperties) {
  const WIDTH_1U = 50;
  return (
    <div
      key={`${props.matrix[0]}-${props.matrix[1]}`}
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
              transformOrigin: `${-props.offsetx * WIDTH_1U}px ${
                -props.offsety * WIDTH_1U
              }px`,
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
    >
      {props.keycode.label ?? props.keycode.aliases?.[0] ?? props.keycode.key}
    </div>
  );
}

function convertToKeymapKeys(
  props: KeymapProperties,
  layoutOptions: { [layout: number]: number },
  keymap: number[]
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
  for (const row of props.layouts.keymap) {
    for (const col of row) {
      match(col)
        .with(P.string, (col) => {
          const layout = col
            .split("\n")[3]
            ?.split(",")
            ?.map((s) => parseInt(s));

              const keyPos = col
                .split("\n")[0]
                .split(",")
                .map((v) => parseInt(v))
                .slice(0, 2);
          if (layoutOptions[layout[0]]==layout[1])
          {
            keys.push({
              ...current,
              matrix: keyPos,
              layout: [],
              keycode: convertIntToKeycode(
                keymap[keyPos[1] + keyPos[0] * props.matrix.cols]
              ),
            });
            current.x += current.w;
            current.w = 1;
            current.h = 1;
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

function LayoutSelector(props: {
  via: ViaKeyboard;
  layouts: {
    labels?: string[][];
  };
  option: { [layout: number]: number };
  onChange: (option: { [layout: number]: number }) => void;
}) {
  return (
    <FormControl variant="standard">
      <Select
        value={props.option[0]}
        label="layout"
        onChange={(event) =>
          props.onChange({ 0: parseInt(event.target.value) })
        }
      >
        {props.layouts.labels[0]?.slice(1).map((label, index) => (
          <MenuItem key={label} value={index}>
            {label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function LayerSelector(props: {layerCount:number, onChange:(layer:number)=>void})
{
  return (
    <>
      {[...Array(props.layerCount)].map((_, idx) => {
        return <Button
          value={idx}
          onClick={(event) => {
            props.onChange(event.target.value);
          }}
        >
          {idx}
        </Button>;
      })}
    </>
  );
}

export function KeymapEditor(props: KeymapProperties) {
  const [layoutOption, setLayoutOption] = useState<{
    [layout: number]: number;
  }>({ 0: 0 });
  const [layerCount, setLayerCount] = useState(1);
  const [layer, setLayer] = useState(0);
  const [keymap, setKeymap] = useState<{ [layer: number]: number[] }>({});

  useEffect(() => {
    navigator.locks.request("load-layout", async () => {
      const layout = await props.via.GetLayoutOption();
      setLayoutOption({ 0: layout });
      const layer = await props.via.GetLayerCount();
      setLayerCount(layer);
      setLayer(0);
      if (!Object.keys(keymap).includes("0")) {
        const layerKeys = await props.via.GetLayer(0, {
          row: props.matrix.rows,
          col: props.matrix.cols,
        });
        setKeymap({ ...keymap, 0: layerKeys });
        console.log("load keymap 0");
        console.log(layerKeys);
      }
    });
  }, [props.layouts]);

  return (
    <div>
      <LayoutSelector
        via={props.via}
        layouts={props.layouts}
        option={layoutOption}
        onChange={(option) => {
          setLayoutOption(option);
        }}
      />
      <LayerSelector
        layerCount={layerCount}
        onChange={async (layer) => {
          if (!Object.keys(keymap).includes(layer.toString())) {
            const layerKeys = await props.via.GetLayer(layer, {
              row: props.matrix.rows,
              col: props.matrix.cols,
            });
            keymap[layer] = layerKeys;
            setKeymap(keymap);
            console.log(`load keymap ${layer}`);
            console.log(layerKeys);
          }
          setLayer(layer);

        }}
      ></LayerSelector>
      {Object.keys(keymap).includes(layer.toString()) ? (
        <div style={{ contain: "layout", marginTop: 50 }}>
          {convertToKeymapKeys(props, layoutOption, keymap[layer]).map((p) =>
            KeymapKey(p)
          )}
        </div>
      ) : (
        <></>
      )}
    </div>
  );
}