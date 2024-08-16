import { useEffect, useMemo, useState } from "react";
import { ViaKeyboard } from "../services/vialKeyboad";
import { KeycodeCatalog } from "./KeycodeCatalog";
import { DefaultQmkKeycode, KeycodeConverter, QmkKeycode } from "./keycodes/keycodeConverter";
import {
  Box,
  Button,
  FormControl,
  Grid,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import {
  KeymapKeyPopUp,
  WIDTH_1U,
} from "./KeymapEditor";

export function TapDanceEditor(props: { via: ViaKeyboard; tapdanceCount: number }) {
  const [tdIndex, setTdIndex] = useState("");
  const keycodeConverter = useMemo(() => {
    return new KeycodeConverter();
  }, []);
  const [tapDance, setTapDance] = useState<{ [id: string]: TapDanceValue }>({});

  useEffect(() => {
    navigator.locks.request("load-tapdance", async () => {
      if (props.tapdanceCount > 0) {
        setTdIndex("0");
        const td = await props.via.GetTapDance(0);
        const newTapDance = { ...tapDance };
        newTapDance["0"] = {
          onTap: keycodeConverter.convertIntToKeycode(td.onTap),
          onHold: keycodeConverter.convertIntToKeycode(td.onHold),
          onDoubleTap: keycodeConverter.convertIntToKeycode(td.onDoubleTap),
          onTapHold: keycodeConverter.convertIntToKeycode(td.onTapHold),
          tappingTerm: td.tappingTerm,
        };
        setTapDance(newTapDance);
      }
    });
  }, [props.tapdanceCount]);

  return (
    <Box>
      <TapDanceSelector
        tapdanceCount={props.tapdanceCount}
        index={tdIndex}
        onChange={async (idx) => {
          setTdIndex(idx);
          if (tapDance[idx] === undefined) {
            const td = await props.via.GetTapDance(parseInt(idx));
            const newTapDance = { ...tapDance };
            newTapDance[idx] = {
              onTap: keycodeConverter.convertIntToKeycode(td.onTap),
              onHold: keycodeConverter.convertIntToKeycode(td.onHold),
              onDoubleTap: keycodeConverter.convertIntToKeycode(td.onDoubleTap),
              onTapHold: keycodeConverter.convertIntToKeycode(td.onTapHold),
              tappingTerm: td.tappingTerm,
            };
            setTapDance(newTapDance);
          }
        }}
      ></TapDanceSelector>
      {tapDance[tdIndex] !== undefined ? (
        <TapDanceEntry
          td={tapDance[tdIndex]}
          keycodeconverter={keycodeConverter}
          onSave={(td: TapDanceValue) => {
            console.log(`Set TD${tdIndex}`);
            console.log(td);
          }}
        ></TapDanceEntry>
      ) : (
        <></>
      )}
      <KeycodeCatalog
        keycodeConverter={keycodeConverter}
        tab={[{ label: "basic", keygroup: ["basic"] }]}
      ></KeycodeCatalog>
    </Box>
  );
}

interface TapDanceValue {
  onTap: QmkKeycode;
  onHold: QmkKeycode;
  onDoubleTap: QmkKeycode;
  onTapHold: QmkKeycode;
  tappingTerm: number;
}

function TapDanceSelector(props: {
  tapdanceCount: number;
  index: string;
  onChange: (idx: string) => void;
}) {
  return (
    <FormControl variant="standard">
      <Select
        value={props.index}
        label="layout"
        onChange={(event) => props.onChange(event.target.value)}
      >
        {[...Array(props.tapdanceCount)].map((_, idx) => {
          return (
            <MenuItem key={idx} value={`${idx}`}>
              {`TD${idx}`}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
}

function TapDanceKey(props: {
  keycode: QmkKeycode;
  onKeycodeChange?: (newKeycode: QmkKeycode) => void;
  onClick?: (target: HTMLElement) => void;
}) {
  return (
    <Box
      width={WIDTH_1U}
      height={WIDTH_1U}
      sx={{ border: "1px solid black" }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const keycode = JSON.parse(event.dataTransfer.getData("QmkKeycode"));
        props.onKeycodeChange?.(keycode);
      }}
      onClick={(event) => props.onClick?.(event.currentTarget)}
    >
      {props.keycode.modLabel ?? ""}
      {props.keycode.label}
      {props.keycode.holdLabel ?? ""}
    </Box>
  );
}

function TapDanceEntry(props: {
  td: TapDanceValue;
  keycodeconverter: KeycodeConverter;
  onSave?: (td: TapDanceValue) => void;
}) {
  const [tappingTerm, setTappingTerm] = useState(props.td.tappingTerm.toString());
  const [popupOpen, setpopupOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | undefined>(undefined);
  const [candidateKeycode, setCandidateKeycode] = useState(DefaultQmkKeycode);
  const [candidateTapdance, setCandidateTapdance] = useState<TapDanceValue>(props.td);
  const [keyIndex, setKeyIndex] = useState(0);

  const handleChange = [
    (value: QmkKeycode) => setCandidateTapdance({ ...candidateTapdance, onTap: value }),
    (value: QmkKeycode) => setCandidateTapdance({ ...candidateTapdance, onHold: value }),
    (value: QmkKeycode) => setCandidateTapdance({ ...candidateTapdance, onDoubleTap: value }),
    (value: QmkKeycode) => setCandidateTapdance({ ...candidateTapdance, onTapHold: value }),
  ];

  useEffect(() => {
    setCandidateTapdance(props.td);
  }, [props.td]);

  return (
    <>
      <Grid container spacing={1}>
        {[
          {
            label: "On tap",
            key: candidateTapdance.onTap,
          },
          {
            label: "On hold",
            key: candidateTapdance.onHold,
          },
          {
            label: "On double tap",
            key: candidateTapdance.onDoubleTap,
          },
          {
            label: "On tap + hold",
            key: candidateTapdance.onTapHold,
          },
        ].map((k, idx) => {
          return (
            <>
              <Grid item xs={5} key={`label-${idx}`}>
                <Box alignContent={"center"} textAlign={"right"} height={"100%"}>
                  {k.label}
                </Box>
              </Grid>
              <Grid item xs={7} key={`item-${idx}`}>
                <TapDanceKey
                  keycode={k.key}
                  onClick={(target) => {
                    setpopupOpen(true);
                    setAnchorEl(target);
                    setCandidateKeycode(k.key);
                    setKeyIndex(idx);
                  }}
                  onKeycodeChange={handleChange[idx]}
                ></TapDanceKey>
              </Grid>
            </>
          );
        })}
        <Grid item xs={5}>
          <Box alignContent={"center"} textAlign={"right"} height={"100%"}>
            Tapping term [ms]
          </Box>
        </Grid>
        <Grid item xs={7}>
          <TextField
            value={tappingTerm}
            onChange={(event) => {
              setTappingTerm(event.target.value);
              const time = parseInt(event.target.value);
              if (0 <= time && time <= 0xffff) {
                setCandidateTapdance({ ...candidateTapdance, tappingTerm: time });
              }
            }}
            sx={{ maxWidth: 150 }}
            size="small"
            type="number"
            InputLabelProps={{
              shrink: true,
            }}
          ></TextField>
        </Grid>
        <Grid item xs={5}>
          <Box sx={{ display: "flex", justifyContent: "right" }}>
            <Button onClick={() => setCandidateTapdance(props.td)}>Clear</Button>
          </Box>
        </Grid>
        <Grid item xs={7}>
          <Button variant="outlined" onClick={() => props.onSave?.(candidateTapdance)}>
            Save
          </Button>
        </Grid>
      </Grid>
      <KeymapKeyPopUp
        open={popupOpen}
        keycode={candidateKeycode}
        keycodeconverter={props.keycodeconverter}
        anchor={anchorEl}
        onClickAway={() => {
          if (popupOpen) {
            setpopupOpen(false);
            setAnchorEl(undefined);
            handleChange[keyIndex](candidateKeycode);
          }
        }}
        onChange={(event) => {
          setCandidateKeycode(event.keycode);
        }}
      ></KeymapKeyPopUp>
    </>
  );
}
