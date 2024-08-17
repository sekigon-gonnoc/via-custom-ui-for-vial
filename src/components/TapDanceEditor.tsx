import React, { Fragment, useEffect, useMemo, useState } from "react";
import { ViaKeyboard } from "../services/vialKeyboad";
import { KeycodeCatalog } from "./KeycodeCatalog";
import { DefaultQmkKeycode, KeycodeConverter, QmkKeycode } from "./keycodes/keycodeConverter";
import { Box, Button, FormControl, Grid, MenuItem, Select, TextField } from "@mui/material";
import { KeymapKeyPopUp, WIDTH_1U } from "./KeymapEditor";

export function TapDanceEditor(props: {
  via: ViaKeyboard;
  keycodeConverter: KeycodeConverter;
  tapdanceIndex: number;
  onBack: () => void;
}) {
  const [tapDance, setTapDance] = useState<{ [id: string]: TapDanceValue }>({});

  useEffect(() => {
    navigator.locks.request("load-tapdance", async () => {
      if (props.tapdanceIndex < 0) return;
      const td = await props.via.GetTapDance(props.tapdanceIndex);
      const newTapDance = { ...tapDance };
      newTapDance[`${props.tapdanceIndex}`] = {
        onTap: props.keycodeConverter.convertIntToKeycode(td.onTap),
        onHold: props.keycodeConverter.convertIntToKeycode(td.onHold),
        onDoubleTap: props.keycodeConverter.convertIntToKeycode(td.onDoubleTap),
        onTapHold: props.keycodeConverter.convertIntToKeycode(td.onTapHold),
        tappingTerm: td.tappingTerm,
      };
      setTapDance(newTapDance);
    });
  }, [props.tapdanceIndex, props.keycodeConverter]);

  return (
    <Box>
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
