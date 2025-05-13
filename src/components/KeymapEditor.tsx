import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  ClickAwayListener,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  InputLabel,
  MenuItem,
  Popper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { matchSorter } from "match-sorter";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { match, P } from "ts-pattern";
import "../App.css";
import { ViaKeyboard } from "../services/vialKeyboad";
import { ComboEditor } from "./ComboEditor";
import { KeycodeCatalog } from "./KeycodeCatalog";
import {
  DefaultQmkKeycode,
  KeycodeConverter,
  ModifierBit,
  ModifierBits,
  QmkKeycode,
} from "./keycodes/keycodeConverter";
import { MacroEditor } from "./MacroEditor";
import { OverrideEditor } from "./OverrideEditor";
import { TapDanceEditor } from "./TapDanceEditor";

// Create a context to track the focused key and keycode change handler
export interface FocusedKeyContextType {
  focusedKey: KeymapKeyProperties | null;
  setFocusedKey: (key: KeymapKeyProperties | null) => void;
  onKeycodeChange?: (target: KeymapKeyProperties, newKeycode: QmkKeycode) => void;
}

export const FocusedKeyContext = createContext<FocusedKeyContextType>({
  focusedKey: null,
  setFocusedKey: () => {},
});

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
  reactKey: string;
  isEncoder?: boolean;
  onKeycodeChange?: (target: KeymapKeyProperties, newKeycode: QmkKeycode) => void;
  onClick?: (target: HTMLElement) => void;
}

export const WIDTH_1U = 60;

export function EditableKey(props: {
  keycode: QmkKeycode;
  onKeycodeChange?: (newKeycode: QmkKeycode) => void;
  onClick?: (target: HTMLElement) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <div
      className={`keymap-key ${isDragOver && "drag-over"}`}
      style={{
        width: WIDTH_1U,
        height: WIDTH_1U,
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const keycode = JSON.parse(event.dataTransfer.getData("QmkKeycode"));
        props.onKeycodeChange?.(keycode);
        setIsDragOver(false);
      }}
      onDragLeave={() => {
        setIsDragOver(false);
      }}
      onClick={(event) => props.onClick?.(event.currentTarget)}
    >
      <Grid container direction={"column"} className="legend-container">
        <Grid item xs={3.5}>
          <div className="mod-legend">{props.keycode.modLabel ?? ""}</div>
        </Grid>
        <Grid item xs={5}>
          <div className="main-legend">{props.keycode.label}</div>
        </Grid>
        <Grid item xs={3.5}>
          <div className="hold-legend">{props.keycode.holdLabel ?? ""}</div>
        </Grid>
      </Grid>
    </div>
  );
}

export function KeymapKey(props: KeymapKeyProperties & { isFocused?: boolean }) {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <div
      key={props.reactKey}
      className={`keymap-key ${props.isEncoder && "keymap-encoder"} ${isDragOver && "drag-over"} ${props.isFocused && "keymap-key-focused"}`}
      style={
        props.r != 0
          ? {
              position: "absolute",
              top: (props.ry + props.offsety) * WIDTH_1U,
              left: (props.rx + props.offsetx) * WIDTH_1U,
              width: props.w * WIDTH_1U - 3,
              height: props.h * WIDTH_1U - 3,
              transform: `rotate(${props.r}deg)`,
              transformOrigin: `${-props.offsetx * WIDTH_1U}px ${-props.offsety * WIDTH_1U}px`,
            }
          : {
              position: "absolute",
              top: props.y * WIDTH_1U,
              left: props.x * WIDTH_1U,
              width: props.w * WIDTH_1U - 3,
              height: props.h * WIDTH_1U - 3,
            }
      }
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const keycode = JSON.parse(event.dataTransfer.getData("QmkKeycode"));
        props.onKeycodeChange?.(props, keycode);
        setIsDragOver(false);
      }}
      onDragLeave={() => {
        setIsDragOver(false);
      }}
      onClick={(event) => props.onClick?.(event.currentTarget)}
    >
      <Grid container direction={"column"} className="legend-container">
        <Grid item xs={3.5}>
          <div className="mod-legend">{props.keycode.modLabel ?? ""}</div>
        </Grid>
        <Grid item xs={5}>
          <div className="main-legend">{props.keycode.label}</div>
        </Grid>
        <Grid item xs={3.5}>
          <div className="hold-legend">{props.keycode.holdLabel ?? ""}</div>
        </Grid>
      </Grid>
    </div>
  );
}

export function KeymapKeyPopUp(props: {
  open: boolean;
  keycodeconverter: KeycodeConverter;
  keycode: QmkKeycode;
  anchor?: HTMLElement;
  boundary: HTMLElement | null;
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
  // Create a container ref for Autocomplete components
  const popupRef = useRef<HTMLDivElement | null>(null);

  const filterOptions = (options: QmkKeycode[], { inputValue }: { inputValue: string }) =>
    matchSorter(options, inputValue, { keys: ["label", "key", "aliases.*"] });

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
      mouseEvent="onMouseUp"
      touchEvent="onTouchEnd"
      onClickAway={(e) => {
        if (!(e.target as HTMLElement).className.includes("keycode-catalog-tab")) {
          props.onClickAway?.();
        }
      }}
    >
      <Popper
        open={props.open}
        anchorEl={props.anchor}
        placement="auto-start"
        modifiers={[
          {
            name: "preventOverflow",
            options: {
              boundary: props.boundary || document.body,
              padding: 8,
            },
          },
          {
            name: "flip",
            options: {
              fallbackPlacements: ["top-start", "top-end", "bottom-start", "bottom-end"],
              boundary: props.boundary || document.body,
            },
          },
        ]}
      >
        <div className="key-select-popup" ref={popupRef}>
          <Autocomplete
            value={tapValue}
            filterOptions={filterOptions}
            onChange={(_event, newValue) => {
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
            onInputChange={(_event, newInputValue) => {
              setTapInputValue(newInputValue);
            }}
            options={props.keycodeconverter.getTapKeycodeList()}
            isOptionEqualToValue={(option, value) => {
              return option.value == value.value;
            }}
            getOptionKey={(option) => option.key}
            getOptionLabel={(option) => option.label}
            renderInput={(params) => <TextField {...params} label="Base(Tap)" />}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <div className="list-label">{option.label}</div>
                <div className="list-key">{option.key}</div>
              </Box>
            )}
            ListboxProps={{
              style: { maxHeight: "200px" },
            }}
            slotProps={{
              popper: {
                container: popupRef.current,
              },
            }}
          ></Autocomplete>

          <Autocomplete
            value={holdValue}
            filterOptions={filterOptions}
            onChange={(_event, newValue) => {
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
            onInputChange={(_event, newInputValue) => {
              setHoldInputValue(newInputValue);
            }}
            options={props.keycodeconverter.getHoldKeycodeList()}
            isOptionEqualToValue={(option, value) => {
              return option.value == value.value;
            }}
            getOptionKey={(option) => option.key}
            getOptionLabel={(option) => option.label}
            renderInput={(params) => <TextField {...params} label="Option(Hold)" />}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <div className="list-label">{option.label}</div>
                <div className="list-key">{option.key}</div>
              </Box>
            )}
            ListboxProps={{
              style: { maxHeight: "200px" },
            }}
            slotProps={{
              popper: {
                container: popupRef.current,
              },
            }}
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
                sx={{ mt: 1, mb: 1, ml: 0, mr: 0 }}
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
                label={<Typography sx={{ fontSize: "0.8rem" }}>{Object.keys(k)[0]}</Typography>}
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
        </div>
      </Popper>
    </ClickAwayListener>
  );
}

function convertToKeymapKeys(
  props: KeymapProperties,
  layoutOptions: { [layout: number]: number },
  keymap: number[],
  encodermap: number[][],
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
  let firstKey = true;
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

          const isEncoder = col.split("\n")[9] === "e";

          if ((layout?.length ?? 0) < 2 || layoutOptions[layout[0]] == layout[1]) {
            if (firstKey) {
              firstKey = false;
              current.y = 0;
            }
            keys.push({
              ...current,
              matrix: keyPos,
              layout: [],
              keycode: keycodeconverter.convertIntToKeycode(
                isEncoder
                  ? (encodermap?.[keyPos[0]]?.[keyPos[1]] ?? 0)
                  : keymap[keyPos[1] + keyPos[0] * props.matrix.cols],
              ),
              isEncoder: isEncoder,
              reactKey: "",
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
    current.w = 1;
    current.h = 1;
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
    <FormControl variant="standard" sx={{ mt: 1 }}>
      <InputLabel>Layout</InputLabel>
      <Select
        value={props.option[0]}
        label="layout"
        onChange={(event) =>
          props.onChange({ 0: event.target.value } as { [layout: number]: number })
        }
      >
        {props.layouts.labels?.[0]?.slice(1).map((label, index) => (
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
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        gap: 1,
        mb: 2,
        mt: 1,
        maxWidth: "100%",
        overflowX: "never",
      }}
    >
      {[...Array(props.layerCount)].map((_, idx) => {
        return (
          <Button
            key={idx}
            value={idx}
            variant="outlined"
            size="small"
            sx={{ minWidth: "36px", flexShrink: 0 }}
            onClick={() => {
              props.onChange(idx);
            }}
          >
            {idx}
          </Button>
        );
      })}
    </Box>
  );
}

function KeymapLayer(props: {
  keymapProps: KeymapProperties;
  layoutOption: { [layout: number]: number };
  keymap: number[];
  encodermap: number[][];
  keycodeconverter: KeycodeConverter;
  onKeycodeChange?: (target: KeymapKeyProperties, newKeycode: QmkKeycode) => void;
}) {
  const [popupOpen, setpopupOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | undefined>(undefined);
  const boundaryEl = useRef<HTMLElement>(null);
  const [focusedKey, setFocusedKey] = useState<KeymapKeyProperties | undefined>(undefined);
  const [candidateKeycode, setCandidateKeycode] = useState<QmkKeycode>(DefaultQmkKeycode);

  // Access the global focus context
  const focusContext = useContext(FocusedKeyContext);

  const keymapkeys = convertToKeymapKeys(
    props.keymapProps,
    props.layoutOption,
    props.keymap,
    props.encodermap,
    props.keycodeconverter,
  );

  // Calculate the rightmost position to determine needed width
  const rightmostPos = Math.max(...keymapkeys.map((key) => key.x + key.w)) * WIDTH_1U + WIDTH_1U; // Add extra space

  // Update context when local focused key changes
  useEffect(() => {
    if (focusedKey) {
      focusContext.setFocusedKey({
        ...focusedKey,
        onKeycodeChange: props.onKeycodeChange,
      });
    } else {
      focusContext.setFocusedKey(null);
    }
  }, [focusedKey, props.onKeycodeChange, focusContext]);

  return (
    <Box ref={boundaryEl}>
      <Box
        sx={{
          position: "relative",
          mt: 1,
          height: `${(Math.max(...keymapkeys.map((k) => k.y)) + 1) * WIDTH_1U}px`,
          width: `${rightmostPos}px`, // Set explicit width based on rightmost key plus padding
          minWidth: "100%", // Ensure it's at least as wide as the container
        }}
      >
        {keymapkeys.map((p, idx) => (
          <KeymapKey
            key={idx}
            {...p}
            isFocused={focusedKey?.reactKey === idx.toString()}
            onKeycodeChange={props.onKeycodeChange}
            onClick={(target) => {
              setCandidateKeycode(p.keycode);
              setFocusedKey({ ...p, reactKey: idx.toString() });
              setpopupOpen(true);
              setAnchorEl(target);
            }}
            reactKey={idx.toString()}
          />
        ))}
      </Box>
      <KeymapKeyPopUp
        open={popupOpen}
        keycodeconverter={props.keycodeconverter}
        keycode={focusedKey?.keycode ?? DefaultQmkKeycode}
        anchor={anchorEl}
        boundary={boundaryEl.current}
        keymapKey={focusedKey}
        onClickAway={() => {
          if (popupOpen) {
            setpopupOpen(false);
            setAnchorEl(undefined);
            setFocusedKey(undefined); // Clear focus when closing popup
            if (focusedKey) {
              props.onKeycodeChange?.(focusedKey!, candidateKeycode);
            }
          }
        }}
        onChange={(event) => {
          setCandidateKeycode(event.keycode);
        }}
      ></KeymapKeyPopUp>
    </Box>
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
  const [encoderCount, setEncoderCount] = useState(0);
  const [encodermap, setEncodermap] = useState<{ [layer: number]: number[][] }>({});

  useEffect(() => {
    navigator.locks.request("load-layout", async () => {
      const layout = await props.via.GetLayoutOption();
      setLayoutOption({ 0: layout });
      setLayer(0);

      const layerKeys = await props.via.GetLayer(0, {
        rows: props.keymap.matrix.rows,
        cols: props.keymap.matrix.cols,
      });
      setKeymap({ 0: layerKeys });

      const encoderCount = props.keymap.layouts.keymap
        .flatMap((row) => row.flatMap((col) => col.toString()))
        .reduce(
          (acc, key) => Math.max(acc, key.endsWith("e") ? parseInt(key.split(",")[0]) + 1 : acc),
          0,
        );
      setEncoderCount(encoderCount);
      setEncodermap({ 0: await props.via.GetEncoder(0, encoderCount) });
    });
  }, [props.keymap, props.via]);

  const sendKeycode = async (layer: number, row: number, col: number, keycode: number) => {
    await props.via.SetKeycode(layer, row, col, keycode);
  };

  const sendEncoder = async (layer: number, index: number, direction: number, keycode: number) => {
    await props.via.SetEncoder([{ layer, index, direction, keycode }]);
  };

  const sendLayout = async (layout: number) => {
    await props.via.SetLayoutOption(layout);
  };

  return (
    <>
      <LayoutSelector
        via={props.via}
        layouts={props.keymap.layouts}
        option={layoutOption}
        onChange={(option) => {
          setLayoutOption(option);
          sendLayout(option[0]);
        }}
      />
      <LayerSelector
        layerCount={props.layerCount}
        onChange={async (layer) => {
          if (!Object.keys(keymap).includes(layer.toString())) {
            const layerKeys = await props.via.GetLayer(layer, {
              rows: props.keymap.matrix.rows,
              cols: props.keymap.matrix.cols,
            });
            const newKeymap = { ...keymap };
            newKeymap[layer] = layerKeys;
            setKeymap(newKeymap);
            console.log(`load keymap ${layer}`);
            console.log(layerKeys);

            setEncodermap({
              ...encodermap,
              [layer]: await props.via.GetEncoder(layer, encoderCount),
            });
          }
          setLayer(layer);
        }}
      ></LayerSelector>

      <Box sx={{ width: "100%", overflowX: "auto", pl: 1, pr: 5 }}>
        {Object.keys(keymap).includes(layer.toString()) ? (
          <KeymapLayer
            keymapProps={props.keymap}
            layoutOption={layoutOption}
            keymap={keymap[layer]}
            encodermap={encodermap[layer] ?? [[]]}
            keycodeconverter={props.keycodeConverter}
            onKeycodeChange={(target, newKeycode) => {
              if (target.isEncoder) {
                const newencoder = { ...encodermap };
                newencoder[layer][target.matrix[0]] =
                  target.matrix[1] == 0
                    ? [newKeycode.value, encodermap[layer][target.matrix[0]][1]]
                    : [encodermap[layer][target.matrix[0]][0], newKeycode.value];
                setEncodermap(newencoder);
                sendEncoder(layer, target.matrix[0], target.matrix[1], newKeycode.value);
                console.log(`update encoder`);
              } else {
                const offset = props.keymap.matrix.cols * target.matrix[0] + target.matrix[1];

                if (keymap[layer][offset] == newKeycode.value) {
                  return;
                }

                const newKeymap = { ...keymap };
                newKeymap[layer][offset] = newKeycode.value;
                setKeymap(newKeymap);
                sendKeycode(layer, target.matrix[0], target.matrix[1], newKeycode.value);
                console.log(
                  `update ${layer},${target.matrix[0]},${target.matrix[1]} to ${newKeycode.value}`,
                );
              }
            }}
          ></KeymapLayer>
        ) : (
          <></>
        )}
      </Box>
    </>
  );
}

function LanguageSelector(props: {
  languageList: string[];
  lang: string;
  onChange: (lang: string) => void;
}) {
  return (
    <FormControl variant="standard">
      <Select
        value={props.lang}
        label="language"
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.languageList.map((label) => (
          <MenuItem key={label} value={label}>
            {label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function KeymapEditor(props: {
  keymap: KeymapProperties;
  via: ViaKeyboard;
  dynamicEntryCount: {
    layer: number;
    macro: number;
    tapdance: number;
    combo: number;
    override: number;
  };
}) {
  const [menuType, setMenuType] = useState<"layer" | "tapdance" | "macro" | "combo" | "override">(
    "layer",
  );
  const [tdIndex, setTdIndex] = useState(-1);
  const [macroIndex, setMacroIndex] = useState(-1);
  const [comboIndex, setComboIndex] = useState(-1);
  const [overrideIndex, setOverrideIndex] = useState(-1);
  const [lang, setLang] = useState("US");
  const [keycodeConverter, setKeycodeConverter] = useState<KeycodeConverter>();

  // State for the focused key context
  const [focusedKey, setFocusedKey] = useState<KeymapKeyProperties | null>(null);

  useEffect(() => {
    KeycodeConverter.Create(
      props.dynamicEntryCount.layer,
      props.keymap.customKeycodes,
      props.dynamicEntryCount.macro,
      props.dynamicEntryCount.tapdance,
      lang,
    ).then((k) => setKeycodeConverter(k));
  }, [props.dynamicEntryCount.layer, props.keymap.customKeycodes, props.dynamicEntryCount, lang]);

  return keycodeConverter === undefined ? (
    <></>
  ) : (
    <FocusedKeyContext.Provider
      value={{ focusedKey, setFocusedKey, onKeycodeChange: focusedKey?.onKeycodeChange }}
    >
      <Box
        sx={{
          width: "100%",
          overflowX: "auto",
          pl: 1,
          pr: 1,
          boxShadow: "0px -2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <Box hidden={menuType !== "layer"}>
          <LayerEditor
            {...props}
            layerCount={props.dynamicEntryCount.layer}
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
        <Box hidden={menuType !== "combo"}>
          <ComboEditor
            via={props.via}
            keycodeConverter={keycodeConverter}
            comboIndex={comboIndex}
            comboCount={props.dynamicEntryCount.combo}
            onBack={() => {
              setMenuType("layer");
            }}
          ></ComboEditor>
        </Box>
        <Box hidden={menuType !== "override"}>
          <OverrideEditor
            via={props.via}
            keycodeConverter={keycodeConverter}
            overrideIndex={overrideIndex}
            overrideCount={props.dynamicEntryCount.override}
            onBack={() => {
              setMenuType("layer");
            }}
          ></OverrideEditor>
        </Box>
      </Box>

      <Box
        sx={{
          position: "relative",
          backgroundColor: "white",
          boxShadow: "0px -2px 10px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "100%",
          overflowX: "auto",
          pb: 3,
          pt: 3,
        }}
      >
        <Box sx={{ pl: 1 }}>
          <LanguageSelector
            languageList={["US", "Japanese"]}
            lang={lang}
            onChange={(lang) => setLang(lang)}
          ></LanguageSelector>
        </Box>
        <KeycodeCatalog
          keycodeConverter={keycodeConverter}
          tab={[
            { label: "Basic", keygroup: ["internal", "basic", "modifiers"] },
            { label: "Mouse", keygroup: ["mouse"] },
            { label: "User/Wireless", keygroup: ["custom", "kb", "user"] },
            { label: "Media", keygroup: ["media"] },
            { label: "Quantum", keygroup: ["quantum"] },
            { label: "Layer", keygroup: ["layer"] },
            { label: "Macro", keygroup: ["macro"] },
            { label: "TapDance", keygroup: ["tapdance"] },
            { label: "Combo/Override", keygroup: ["combo", "keyoverride"] },
          ]}
          comboCount={props.dynamicEntryCount.combo}
          overrideCount={props.dynamicEntryCount.override}
          onTapdanceSelect={(index) => {
            setMenuType("tapdance");
            setTdIndex(index);
          }}
          onMacroSelect={(index) => {
            setMenuType("macro");
            setMacroIndex(index);
          }}
          onComoboSelect={(index) => {
            setMenuType("combo");
            setComboIndex(index);
          }}
          onOverrideSelect={(index) => {
            setMenuType("override");
            setOverrideIndex(index);
          }}
        ></KeycodeCatalog>
      </Box>
    </FocusedKeyContext.Provider>
  );
}
