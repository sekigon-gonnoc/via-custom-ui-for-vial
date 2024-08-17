import { Box, Button, Grid } from "@mui/material";
import { ViaKeyboard } from "../services/vialKeyboad";
import { DefaultQmkKeycode, KeycodeConverter, QmkKeycode } from "./keycodes/keycodeConverter";
import { Fragment, useEffect, useState } from "react";
import { EditableKey, KeymapKeyPopUp, WIDTH_1U } from "./KeymapEditor";

export function ComboEditor(props: {
  via: ViaKeyboard;
  keycodeConverter: KeycodeConverter;
  comboIndex: number;
  comboCount: number;
  onBack: () => void;
}) {
  const [combo, setCombo] = useState<{ [id: string]: ComboValue }>({});

  useEffect(() => {
    navigator.locks.request("load-combo", async () => {
      if (props.comboIndex < 0) return;

      const comboValue = await props.via.GetCombo(props.comboIndex);
      const newCombo = { ...combo };
      newCombo[`${props.comboIndex}`] = {
        keys: [
          props.keycodeConverter.convertIntToKeycode(comboValue.key1),
          props.keycodeConverter.convertIntToKeycode(comboValue.key2),
          props.keycodeConverter.convertIntToKeycode(comboValue.key3),
          props.keycodeConverter.convertIntToKeycode(comboValue.key4),
          props.keycodeConverter.convertIntToKeycode(comboValue.output),
        ],
      };
      setCombo(newCombo);
      console.log(newCombo);
    });
  }, [props.comboIndex, props.keycodeConverter]);

  return (
    <Box>
      <div>{`Edit combo ${props.comboIndex}`}</div>
      <ComboEntry
        combo={
          combo[props.comboIndex] ?? {
            keys: [
              DefaultQmkKeycode,
              DefaultQmkKeycode,
              DefaultQmkKeycode,
              DefaultQmkKeycode,
              DefaultQmkKeycode,
            ],
          }
        }
        keycodeconverter={props.keycodeConverter}
        onSave={(newCombo) => {
          const newComboSet = { ...combo };
          newComboSet[props.comboIndex] = newCombo;
          setCombo(newComboSet);
          console.log(`update combo ${props.comboIndex}`);
        }}
        onBack={props.onBack}
      ></ComboEntry>
    </Box>
  );
}

interface ComboValue {
  keys: [QmkKeycode, QmkKeycode, QmkKeycode, QmkKeycode, QmkKeycode];
}

function ComboEntry(props: {
  combo: ComboValue;
  keycodeconverter: KeycodeConverter;
  onSave?: (combo: ComboValue) => void;
  onBack?: () => void;
}) {
  const [popupOpen, setpopupOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | undefined>(undefined);
  const [candidateKeycode, setCandidateKeycode] = useState(DefaultQmkKeycode);
  const [candidateCombo, setCandidateCombo] = useState<ComboValue>(props.combo);
  const [keyIndex, setKeyIndex] = useState(0);

  useEffect(() => {
    setCandidateCombo(props.combo);
  }, [props.combo]);

  return (
    <>
      <Box mt={2}></Box>
      <Grid container spacing={1}>
        {candidateCombo.keys.map((k, idx) => {
          return (
            <Fragment key={idx}>
              <Grid item xs={5}>
                <Box alignContent={"center"} textAlign={"right"} height={"100%"}>
                  {["key 1", "key 2", "key 3", "key 4", "output key"][idx]}
                </Box>
              </Grid>
              <Grid item xs={7}>
                <EditableKey
                  keycode={k}
                  onClick={(target) => {
                    setpopupOpen(true);
                    setAnchorEl(target);
                    setCandidateKeycode(k);
                    setKeyIndex(idx);
                  }}
                  onKeycodeChange={(keycode) => {
                    setCandidateCombo({
                      keys: candidateCombo.keys.map((k, id) => (id == idx ? keycode : k)),
                    } as ComboValue);
                  }}
                ></EditableKey>
              </Grid>
            </Fragment>
          );
        })}
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
            <Button onClick={() => setCandidateCombo(props.combo)}>Clear</Button>
          </Box>
        </Grid>
        <Grid item xs={7}>
          <Button variant="outlined" onClick={() => props.onSave?.(candidateCombo)}>
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
            setCandidateCombo({
              keys: candidateCombo.keys.map((k, id) => (id == keyIndex ? candidateKeycode : k)),
            } as ComboValue);
          }
        }}
        onChange={(event) => {
          setCandidateKeycode(event.keycode);
        }}
      ></KeymapKeyPopUp>
    </>
  );
}
