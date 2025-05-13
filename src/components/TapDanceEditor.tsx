import { Box, Button, Grid, TextField } from "@mui/material";
import { Fragment, useEffect, useRef, useState } from "react";
import { ViaKeyboard } from "../services/vialKeyboad";
import { DefaultQmkKeycode, KeycodeConverter, QmkKeycode } from "./keycodes/keycodeConverter";
import { EditableKey, KeymapKeyPopUp } from "./KeymapEditor";

export function TapDanceEditor(props: {
  via: ViaKeyboard;
  keycodeConverter: KeycodeConverter;
  tapdanceIndex: number;
  onBack: () => void;
}) {
  const [tapDance, setTapDance] = useState<{ [id: string]: TapDanceValue }>({});
  const boundaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    navigator.locks.request("load-tapdance", async () => {
      if (props.tapdanceIndex < 0) return;
      const td = (await props.via.GetTapDance([props.tapdanceIndex]))[0];
      const newTapDance = { ...tapDance };
      newTapDance[`${props.tapdanceIndex}`] = props.keycodeConverter.convertTapDance(td);
      setTapDance(newTapDance);
    });
  }, [props.tapdanceIndex, props.keycodeConverter]);

  const sendTapdance = (id: number, value: TapDanceValue) => {
    props.via.SetTapDance([
      {
        id: id,
        onTap: value.onTap.value,
        onHold: value.onHold.value,
        onDoubleTap: value.onDoubleTap.value,
        onTapHold: value.onTapHold.value,
        tappingTerm: value.tappingTerm,
      },
    ]);
  };

  return (
    <Box ref={boundaryRef}>
      <Box>{`Edit TD${props.tapdanceIndex}`}</Box>
      <TapDanceEntry
        td={
          tapDance[props.tapdanceIndex] ?? {
            onTap: DefaultQmkKeycode,
            onHold: DefaultQmkKeycode,
            onDoubleTap: DefaultQmkKeycode,
            onTapHold: DefaultQmkKeycode,
            tappingTerm: 200,
          }
        }
        keycodeconverter={props.keycodeConverter}
        onSave={(td: TapDanceValue) => {
          console.log(`Set TD${props.tapdanceIndex}`);
          console.log(td);
          sendTapdance(props.tapdanceIndex, td);
        }}
        onBack={props.onBack}
      ></TapDanceEntry>
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

function TapDanceEntry(props: {
  td: TapDanceValue;
  keycodeconverter: KeycodeConverter;
  boundaryRef?: React.RefObject<HTMLDivElement>;
  onSave?: (td: TapDanceValue) => void;
  onBack?: () => void;
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
    setTappingTerm(props.td.tappingTerm.toString());
  }, [props.td]);

  return (
    <>
      <Box mt={2}></Box>
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
            <Fragment key={idx}>
              <Grid item xs={5}>
                <Box alignContent={"center"} textAlign={"right"} height={"100%"}>
                  {k.label}
                </Box>
              </Grid>
              <Grid item xs={7}>
                <EditableKey
                  keycode={k.key}
                  onClick={(target) => {
                    setpopupOpen(true);
                    setAnchorEl(target);
                    setCandidateKeycode(k.key);
                    setKeyIndex(idx);
                  }}
                  onKeycodeChange={handleChange[idx]}
                ></EditableKey>
              </Grid>
            </Fragment>
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
        <Grid item xs={1}>
          <Button
            onClick={() => {
              props.onBack?.();
            }}
          >
            BACK
          </Button>
        </Grid>
        <Grid item xs={4}>
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
        boundary={props.boundaryRef?.current ?? null}
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
