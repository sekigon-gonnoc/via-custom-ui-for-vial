import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  ClickAwayListener,
  FormControl,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Popper,
  Select,
  TextField,
} from "@mui/material";
import { ViaKeyboard } from "../services/vialKeyboad";
import { useEffect, useMemo, useState } from "react";
import {
  DefaultQmkKeycode,
  QmkKeycode,
  KeycodeConverter,
  ModifierBits,
  ModifierBit,
} from "./keycodes/keycodeConverter";
import { KeycodeCatalog } from "./KeycodeCatalog";
import { TapDanceEditor } from "./TapDanceEditor";
import { match, P } from "ts-pattern";
import { MacroEditor } from "./MacroEditor";

export interface KeymapProperties {
  matrix: { rows: number; cols: number };
  layouts: {
    labels?: string[][];
    keymap: (
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
  };
  customKeycodes?: { name: string; title: string; shortName: string }[];
}

export interface KeymapKeyProperties {
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
  onKeycodeChange?: (target: KeymapKeyProperties, newKeycode: QmkKeycode) => void;
  onClick?: (target: HTMLElement) => void;
}

export const WIDTH_1U = 50;
export function KeymapKey(props: KeymapKeyProperties) {
  return (
    <div
      key={`${props.matrix[0]}-${props.matrix[1]}`}
      style={
        props.r != 0
          ? {
              position: "absolute",
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
              position: "absolute",
              top: props.y * WIDTH_1U,
              left: props.x * WIDTH_1U,
              width: props.w * WIDTH_1U - 3,
              height: props.h * WIDTH_1U - 3,
              outline: "solid",
              outlineWidth: "1px",
              outlineColor: "black",
            }
      }
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const keycode = JSON.parse(event.dataTransfer.getData("QmkKeycode"));
        props.onKeycodeChange?.(props, keycode);
      }}
      onClick={(event) => props.onClick?.(event.currentTarget)}
    >
      {props.keycode.modLabel ?? ""}
      {props.keycode.label}
      {props.keycode.holdLabel ?? ""}
    </div>
  );
}

export function KeymapKeyPopUp(props: {
  open: boolean;
  keycodeconverter: KeycodeConverter;
  keycode: QmkKeycode;
  anchor?: HTMLElement;
  keymapKey?: KeymapKeyProperties;
  onClickAway?: () => void;
  onChange?: (event: { keymapkey?: KeymapKeyProperties; keycode: QmkKeycode }) => void;
}) {
  const [tapValue, setTapValue] = useState<QmkKeycode>(
    props.keycodeconverter.getTapKeycode(props.keycode),
  );
  const [tapInputValue, setTapInputValue] = useState<string>(
    props.keycodeconverter.getTapKeycode(props.keycode).label,
  );
  const [holdValue, setHoldValue] = useState<QmkKeycode>(
    props.keycodeconverter.getHoldKeycode(props.keycode),
  );
  const [holdInputValue, setHoldInputValue] = useState<string>(
    props.keycodeconverter.getHoldKeycode(props.keycode).label,
  );
  const [modsValue, setModsValue] = useState<ModifierBits>(
    props.keycodeconverter.getModifier(props.keycode),
  );
  const [keycodeValue, setKeycodeValue] = useState<string>("");
  useEffect(() => {
    setTapValue(props.keycodeconverter.getTapKeycode(props.keycode));
    setTapInputValue(props.keycodeconverter.getTapKeycode(props.keycode).label);
    setHoldValue(props.keycodeconverter.getHoldKeycode(props.keycode));
    setHoldInputValue(props.keycodeconverter.getHoldKeycode(props.keycode).label);
    setModsValue(props.keycodeconverter.getModifier(props.keycode));
    setKeycodeValue((props.keycode.value ?? 0).toString());
  }, [props.keycode]);
  return (
    <ClickAwayListener
      mouseEvent="onMouseDown"
      touchEvent="onTouchStart"
      onClickAway={() => props.onClickAway?.()}
    >
      <Popper open={props.open} anchorEl={props.anchor} placement="bottom-start">
        <Box width={400} border={1} p={1} bgcolor="white">
          <Autocomplete
            value={tapValue}
            onChange={(event: any, newValue) => {
              setTapValue(newValue ?? DefaultQmkKeycode);
              const newKeycode =
                props.keycodeconverter.combineKeycodes(
                  newValue ?? DefaultQmkKeycode,
                  holdValue,
                  modsValue,
                ) ?? DefaultQmkKeycode;
              setKeycodeValue(newKeycode.value.toString());
              props.onChange?.({
                keymapkey: props.keymapKey,
                keycode: newKeycode,
              });
            }}
            inputValue={tapInputValue}
            onInputChange={(event, newInputValue) => {
              setTapInputValue(newInputValue);
            }}
            options={props.keycodeconverter.getTapKeycodeList()}
            isOptionEqualToValue={(option, value) => {
              return option.value == value.value;
            }}
            getOptionKey={(option) => option.key}
            getOptionLabel={(option) => option.label}
            renderInput={(params) => <TextField {...params} label="Base(Tap)" />}
            renderOption={(props, option, state, ownerState) => (
              <Box component="li" {...props}>
                <div>{option.label}</div>
                <div>{option.key}</div>
              </Box>
            )}
          ></Autocomplete>

          <Autocomplete
            value={holdValue}
            onChange={(event: any, newValue) => {
              setHoldValue(newValue ?? DefaultQmkKeycode);
              const newKeycode =
                props.keycodeconverter.combineKeycodes(
                  tapValue,
                  newValue ?? DefaultQmkKeycode,
                  modsValue,
                ) ?? DefaultQmkKeycode;
              setKeycodeValue(newKeycode.value.toString());
              props.onChange?.({
                keymapkey: props.keymapKey,
                keycode: newKeycode,
              });
            }}
            inputValue={holdInputValue}
            onInputChange={(event, newInputValue) => {
              setHoldInputValue(newInputValue);
            }}
            options={props.keycodeconverter.getHoldKeycodeList()}
            isOptionEqualToValue={(option, value) => {
              return option.value == value.value;
            }}
            getOptionKey={(option) => option.key}
            getOptionLabel={(option) => option.label}
            renderInput={(params) => <TextField {...params} label="Option(Hold)" />}
            renderOption={(props, option, state, ownerState) => (
              <Box component="li" {...props}>
                <div>{option.label}</div>
                <div>{option.key}</div>
              </Box>
            )}
          ></Autocomplete>
          <FormGroup row>
            {(
              [
                { Ctrl: ModifierBit.Ctrl },
                { Shift: ModifierBit.Shift },
                { Alt: ModifierBit.Alt },
                { GUI: ModifierBit.GUI },
                { UseRight: ModifierBit.UseRight },
              ] as { [key: string]: ModifierBit }[]
            ).map((k, idx) => (
              <FormControlLabel
                key={idx}
                value={Object.keys(k)[0]}
                sx={{ margin: 1 }}
                control={
                  <Checkbox
                    checked={(modsValue & Object.values(k)[0]) !== 0}
                    onChange={(event) => {
                      const newMods = event.target.checked
                        ? modsValue | Object.values(k)[0]
                        : modsValue & ~Object.values(k)[0];
                      console.log(`new mods ${newMods}`);
                      setModsValue(newMods);
                      const newKeycode =
                        props.keycodeconverter.combineKeycodes(tapValue, holdValue, newMods) ??
                        DefaultQmkKeycode;
                      setKeycodeValue(newKeycode.value.toString());
                      props.onChange?.({
                        keymapkey: props.keymapKey,
                        keycode: newKeycode,
                      });
                    }}
                    size="small"
                  ></Checkbox>
                }
                label={Object.keys(k)[0]}
                labelPlacement="top"
              ></FormControlLabel>
            ))}
          </FormGroup>
          <TextField
            label="Keycode(decimal)"
            variant="outlined"
            value={keycodeValue.toString()}
            onChange={(event) => {
              setKeycodeValue(event.target.value);
              const keycodeValue = parseInt(event.target.value);
              if (0 <= keycodeValue && keycodeValue <= 0xffff) {
                const keycode = props.keycodeconverter.convertIntToKeycode(keycodeValue);
                setTapValue(props.keycodeconverter.getTapKeycode(keycode));
                setTapInputValue(props.keycodeconverter.getTapKeycode(keycode).label);
                setHoldValue(props.keycodeconverter.getHoldKeycode(keycode));
                setHoldInputValue(props.keycodeconverter.getHoldKeycode(keycode).label);
                setModsValue(props.keycodeconverter.getModifier(keycode));
                props.onChange?.({
                  keymapkey: props.keymapKey,
                  keycode: props.keycodeconverter.convertIntToKeycode(keycodeValue),
                });
              }
            }}
          ></TextField>
        </Box>
      </Popper>
    </ClickAwayListener>
  );
}

function convertToKeymapKeys(
  props: KeymapProperties,
  layoutOptions: { [layout: number]: number },
  keymap: number[],
  keycodeconverter: KeycodeConverter,
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
          if (layoutOptions[layout[0]] == layout[1]) {
            keys.push({
              ...current,
              matrix: keyPos,
              layout: [],
              keycode: keycodeconverter.convertIntToKeycode(
                keymap[keyPos[1] + keyPos[0] * props.matrix.cols],
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
            x: current.x + (col.r ? 0 : (col.x ?? 0)),
            y: current.y + (col.r ? 0 : (col.y ?? 0)),
            offsetx: col.r ? (col.x ?? 0) : 0,
            offsety: col.r ? (col.y ?? 0) : 0,
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
          props.onChange({ 0: event.target.value } as { [layout: number]: number })
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

function LayerSelector(props: { layerCount: number; onChange: (layer: number) => void }) {
  return (
    <>
      {[...Array(props.layerCount)].map((_, idx) => {
        return (
          <Button
            key={idx}
            value={idx}
            onClick={() => {
              props.onChange(idx);
            }}
          >
            {idx}
          </Button>
        );
      })}
    </>
  );
}

function KeymapLayer(props: {
  keymapProps: KeymapProperties;
  layoutOption: { [layout: number]: number };
  keymap: number[];
  keycodeconverter: KeycodeConverter;
  onKeycodeChange?: (target: KeymapKeyProperties, newKeycode: QmkKeycode) => void;
}) {
  const [popupOpen, setpopupOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | undefined>(undefined);
  const [focusedKey, setFocusedKey] = useState<KeymapKeyProperties | undefined>(undefined);
  const [candidateKeycode, setCandidateKeycode] = useState<QmkKeycode>(DefaultQmkKeycode);

  const keymapkeys = convertToKeymapKeys(
    props.keymapProps,
    props.layoutOption,
    props.keymap,
    props.keycodeconverter,
  );

  return (
    <>
      <div
        style={{
          position: "relative",
          marginTop: 50,
          height: `${(Math.max(...keymapkeys.map((k) => k.y)) + 2) * WIDTH_1U}px`,
        }}
      >
        {keymapkeys.map((p) =>
          KeymapKey({
            ...p,
            onKeycodeChange: props.onKeycodeChange,
            onClick: (target) => {
              setCandidateKeycode(p.keycode);
              setFocusedKey(p);
              setpopupOpen(true);
              setAnchorEl(target);
            },
          }),
        )}
      </div>
      <KeymapKeyPopUp
        open={popupOpen}
        keycodeconverter={props.keycodeconverter}
        keycode={focusedKey?.keycode ?? DefaultQmkKeycode}
        anchor={anchorEl}
        keymapKey={focusedKey}
        onClickAway={() => {
          if (popupOpen) {
            setpopupOpen(false);
            setAnchorEl(undefined);
            if (focusedKey) {
              props.onKeycodeChange?.(focusedKey!, candidateKeycode);
            }
          }
        }}
        onChange={(event) => {
          setCandidateKeycode(event.keycode);
        }}
      ></KeymapKeyPopUp>
    </>
  );
}

function LayerEditor(props: {
  keymap: KeymapProperties;
  via: ViaKeyboard;
  layerCount: number;
  keycodeConverter: KeycodeConverter;
  dynamicEntryCount: { tapdance: number };
  onTapdanceSelect?: (index: number) => void;
  onMacroSelect?: (index: number) => void;
}) {
  const [layoutOption, setLayoutOption] = useState<{
    [layout: number]: number;
  }>({ 0: 0 });
  const [layer, setLayer] = useState(0);
  const [keymap, setKeymap] = useState<{ [layer: number]: number[] }>({});

  useEffect(() => {
    navigator.locks.request("load-layout", async () => {
      const layout = await props.via.GetLayoutOption();
      setLayoutOption({ 0: layout });
      setLayer(0);
      if (!Object.keys(keymap).includes("0")) {
        const layerKeys = await props.via.GetLayer(0, {
          row: props.keymap.matrix.rows,
          col: props.keymap.matrix.cols,
        });
        setKeymap({ ...keymap, 0: layerKeys });
      }
    });
  }, [props.keymap, props.via]);

  return (
    <>
      <div>
        <LayoutSelector
          via={props.via}
          layouts={props.keymap.layouts}
          option={layoutOption}
          onChange={(option) => {
            setLayoutOption(option);
          }}
        />
        <LayerSelector
          layerCount={props.layerCount}
          onChange={async (layer) => {
            if (!Object.keys(keymap).includes(layer.toString())) {
              const layerKeys = await props.via.GetLayer(layer, {
                row: props.keymap.matrix.rows,
                col: props.keymap.matrix.cols,
              });
              const newKeymap = { ...keymap };
              newKeymap[layer] = layerKeys;
              setKeymap(newKeymap);
              console.log(`load keymap ${layer}`);
              console.log(layerKeys);
            }
            setLayer(layer);
          }}
        ></LayerSelector>
        {Object.keys(keymap).includes(layer.toString()) ? (
          <KeymapLayer
            keymapProps={props.keymap}
            layoutOption={layoutOption}
            keymap={keymap[layer]}
            keycodeconverter={props.keycodeConverter}
            onKeycodeChange={(target, newKeycode) => {
              const offset = props.keymap.matrix.cols * target.matrix[0] + target.matrix[1];
              const newKeymap = { ...keymap };
              newKeymap[layer][offset] = newKeycode.value;
              setKeymap(newKeymap);
              console.log(
                `update ${layer},${target.matrix[0]},${target.matrix[1]} to ${newKeycode.value}`,
              );
            }}
          ></KeymapLayer>
        ) : (
          <></>
        )}
      </div>
    </>
  );
}

export function KeymapEditor(props: {
  keymap: KeymapProperties;
  via: ViaKeyboard;
  dynamicEntryCount: {
    macro: number;
    tapdance: number;
    combo: number;
    override: number;
  };
}) {
  const [menuType, setMenuType] = useState<"layer" | "tapdance" | "macro">("layer");
  const [layerCount, setLayerCount] = useState(1);
  const [tdIndex, setTdIndex] = useState(-1);
  const [macroIndex, setMacroIndex] = useState(-1);

  useEffect(() => {
    navigator.locks.request("load-layout", async () => {
      const layerCount = await props.via.GetLayerCount();
      setLayerCount(layerCount);
    });
  }, [props.via, props.keymap]);

  const keycodeConverter = useMemo(() => {
    return new KeycodeConverter(
      layerCount,
      props.keymap.customKeycodes,
      props.dynamicEntryCount.macro,
      props.dynamicEntryCount.tapdance,
    );
  }, [layerCount, props.keymap.customKeycodes, props.dynamicEntryCount]);

  return (
    <>
      <Box hidden={menuType !== "layer"}>
        <LayerEditor
          {...props}
          layerCount={layerCount}
          keycodeConverter={keycodeConverter}
        ></LayerEditor>
      </Box>
      <Box hidden={menuType !== "tapdance"}>
        <TapDanceEditor
          via={props.via}
          keycodeConverter={keycodeConverter}
          tapdanceIndex={tdIndex}
          onBack={() => {
            setMenuType("layer");
          }}
        ></TapDanceEditor>
      </Box>
      <Box hidden={menuType !== "macro"}>
        <MacroEditor
          via={props.via}
          keycodeConverter={keycodeConverter}
          macroIndex={macroIndex}
          macroCount={props.dynamicEntryCount.macro}
          onBack={() => {
            setMenuType("layer");
          }}
        ></MacroEditor>
      </Box>
      <KeycodeCatalog
        keycodeConverter={keycodeConverter}
        tab={[
          { label: "Basic", keygroup: ["basic", "modifiers"] },
          { label: "Mouse", keygroup: ["mouse"] },
          { label: "User/Wireless", keygroup: ["custom", "kb", "user"] },
          { label: "Media", keygroup: ["media"] },
          { label: "Quantum", keygroup: ["quantum"] },
          { label: "Macro", keygroup: ["macro"] },
          { label: "TapDance", keygroup: ["tapdance"] },
        ]}
        onTapdanceSelect={(index) => {
          setMenuType("tapdance");
          setTdIndex(index);
        }}
        onMacroSelect={(index) => {
          setMenuType("macro");
          setMacroIndex(index);
        }}
      ></KeycodeCatalog>
    </>
  );
}
