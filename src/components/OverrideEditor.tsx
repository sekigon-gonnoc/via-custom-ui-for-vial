import { Box, Button, Checkbox, FormControlLabel, FormGroup, Grid, Switch } from "@mui/material";
import { Fragment, useEffect, useState } from "react";
import { ViaKeyboard } from "../services/vialKeyboad";
import { DefaultQmkKeycode, KeycodeConverter, QmkKeycode } from "./keycodes/keycodeConverter";
import { EditableKey, KeymapKeyPopUp } from "./KeymapEditor";

export function OverrideEditor(props: {
  via: ViaKeyboard;
  keycodeConverter: KeycodeConverter;
  overrideIndex: number;
  overrideCount: number;
  onBack: () => void;
}) {
  const [override, setOverride] = useState<{ [id: string]: OverrideValue }>({});

  useEffect(() => {
    navigator.locks.request("load-override", async () => {
      if (props.overrideIndex < 0) return;

      const overrideValue = await props.via.GetOverride(props.overrideIndex);
      const newOverride = { ...override };
      newOverride[`${props.overrideIndex}`] = {
        ...overrideValue,
        trigger: props.keycodeConverter.convertIntToKeycode(overrideValue.trigger),
        replacement: props.keycodeConverter.convertIntToKeycode(overrideValue.replacement),
      };
      setOverride(newOverride);
      console.log(newOverride);
    });
  }, [props.overrideIndex, props.keycodeConverter]);

  const sendOverride = (id: number, value: OverrideValue) => {
    props.via.SetOverride({
      ...value,
      id: id,
      trigger: value.trigger.value,
      replacement: value.replacement.value,
    });
  };

  return (
    <Box>
      <div>{`Edit override ${props.overrideIndex}`}</div>
      <OverrideEntry
        override={
          override[props.overrideIndex] ?? {
            trigger: DefaultQmkKeycode,
            replacement: DefaultQmkKeycode,
            layers: 0,
            triggerMods: 0,
            negativeModMask: 0,
            suppressedMods: 0,
            options: 0,
          }
        }
        keycodeconverter={props.keycodeConverter}
        onSave={(newOverride) => {
          const newOverrideSet = { ...override };
          newOverrideSet[props.overrideIndex] = newOverride;
          setOverride(newOverrideSet);
          sendOverride(props.overrideIndex, newOverride);
          console.log(`update override ${props.overrideIndex}`);
          console.log(newOverride);
        }}
        onBack={props.onBack}
      ></OverrideEntry>
    </Box>
  );
}

interface OverrideValue {
  trigger: QmkKeycode;
  replacement: QmkKeycode;
  layers: number;
  triggerMods: number;
  negativeModMask: number;
  suppressedMods: number;
  options: number;
}

enum OverrideOption {
  ACTIVATION_TRIGGER_DOWN = 1 << 0,
  ACTIVATION_REQUIRED_MOD_DOWN = 1 << 1,
  ACTIVATION_NEGATIVE_MOD_UP = 1 << 2,
  ONE_MOD = 1 << 3,
  NO_REREGISTER_TRIGGER = 1 << 4,
  NO_UNREGISTER_ON_OTHER_KEY_DOWN = 1 << 5,
  ENABLED = 1 << 7,
}

function OverrideEntry(props: {
  override: OverrideValue;
  keycodeconverter: KeycodeConverter;
  onSave?: (override: OverrideValue) => void;
  onBack?: () => void;
}) {
  const [popupOpen, setpopupOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | undefined>(undefined);
  const [candidateKeycode, setCandidateKeycode] = useState(DefaultQmkKeycode);
  const [candidateOverride, setCandidateOverride] = useState<OverrideValue>(props.override);
  const [keyIndex, setKeyIndex] = useState(0);

  useEffect(() => {
    setCandidateOverride(props.override);
  }, [props.override]);

  return (
    <>
      <Box mt={2}></Box>
      <Grid container spacing={1}>
        <Grid item xs={5}>
          <Box alignContent={"center"} textAlign={"right"} height={"100%"}>
            Enable
          </Box>
        </Grid>
        <Grid item xs={7}>
          <Switch
            checked={(candidateOverride.options & OverrideOption.ENABLED) != 0}
            onChange={(_event, checked) => {
              setCandidateOverride({
                ...candidateOverride,
                options:
                  (candidateOverride.options & ~OverrideOption.ENABLED) |
                  (checked ? OverrideOption.ENABLED : 0),
              });
            }}
          ></Switch>
        </Grid>

        <Grid item xs={5}>
          <Box alignContent={"center"} textAlign={"right"} height={"100%"}>
            Trigger mods
          </Box>
        </Grid>
        <Grid item xs={7}>
          <ModifierCheckbox
            value={candidateOverride.triggerMods}
            onChange={(value) => setCandidateOverride({ ...candidateOverride, triggerMods: value })}
          ></ModifierCheckbox>
        </Grid>

        {[candidateOverride.trigger, candidateOverride.replacement].map((k, idx) => {
          return (
            <Fragment key={idx}>
              <Grid item xs={5}>
                <Box alignContent={"center"} textAlign={"right"} height={"100%"}>
                  {["Trigger", "Override"][idx]}
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
                    if (idx == 0) {
                      setCandidateOverride({ ...candidateOverride, trigger: keycode });
                    } else if (idx == 1) {
                      setCandidateOverride({ ...candidateOverride, replacement: keycode });
                    }
                  }}
                ></EditableKey>
              </Grid>
            </Fragment>
          );
        })}

        <Grid item xs={5}>
          <Box alignContent={"center"} textAlign={"right"} height={"100%"}>
            Negative mods
          </Box>
        </Grid>
        <Grid item xs={7}>
          <ModifierCheckbox
            value={candidateOverride.negativeModMask}
            onChange={(value) =>
              setCandidateOverride({ ...candidateOverride, negativeModMask: value })
            }
          ></ModifierCheckbox>
        </Grid>

        <Grid item xs={5}>
          <Box alignContent={"center"} textAlign={"right"} height={"100%"}>
            Suppressed mods
          </Box>
        </Grid>
        <Grid item xs={7}>
          <ModifierCheckbox
            value={candidateOverride.suppressedMods}
            onChange={(value) =>
              setCandidateOverride({ ...candidateOverride, suppressedMods: value })
            }
          ></ModifierCheckbox>
        </Grid>

        <Grid item xs={5}>
          <Box alignContent={"center"} textAlign={"right"} height={"100%"}>
            Enable on layers
          </Box>
        </Grid>
        <Grid item xs={7}>
          <FormGroup row>
            {[...Array(16)].map((_, idx) => {
              return (
                <FormControlLabel
                  key={idx}
                  label={`${idx}`}
                  style={{ minWidth: "60px" }}
                  control={
                    <Checkbox
                      size="small"
                      checked={(candidateOverride.layers & (1 << idx)) > 0}
                      onChange={(_event, checked) => {
                        setCandidateOverride({
                          ...candidateOverride,
                          layers:
                            (candidateOverride.layers & ~(1 << idx)) | (checked ? 1 << idx : 0),
                        });
                      }}
                    ></Checkbox>
                  }
                ></FormControlLabel>
              );
            })}
          </FormGroup>
        </Grid>

        <Grid item xs={5}></Grid>
        <Grid item xs={7}>
          <Button onClick={() => setCandidateOverride({ ...candidateOverride, layers: 0xffff })}>
            Enable all
          </Button>
          <Button onClick={() => setCandidateOverride({ ...candidateOverride, layers: 0x0000 })}>
            Disable all
          </Button>
        </Grid>

        <Grid item xs={5}>
          <Box alignContent={"center"} textAlign={"right"} height={"100%"}>
            Options
          </Box>
        </Grid>
        <Grid item xs={7}>
          <FormGroup>
            {[
              "Activate when the trigger key is pressed down",
              "Activate when a necessary  modifier is pressed down",
              "Activate when a negative  modifier is released",
              "Activate on one modifier",
              "Don't deactivate when another key is pressed down",
              "Don't register the trigger key again after the override is deactivated",
            ].map((label, idx) => {
              return (
                <FormControlLabel
                  key={idx}
                  label={label}
                  control={
                    <Checkbox
                      size="small"
                      checked={(candidateOverride.options & (1 << idx)) != 0}
                      onChange={(_event, checked) => {
                        setCandidateOverride({
                          ...candidateOverride,
                          options:
                            (candidateOverride.options & ~(1 << idx)) | (checked ? 1 << idx : 0),
                        });
                      }}
                    ></Checkbox>
                  }
                />
              );
            })}
          </FormGroup>
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
            <Button onClick={() => setCandidateOverride(props.override)}>Clear</Button>
          </Box>
        </Grid>
        <Grid item xs={7}>
          <Button variant="outlined" onClick={() => props.onSave?.(candidateOverride)}>
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
            if (keyIndex == 0) {
              setCandidateOverride({ ...candidateOverride, trigger: candidateKeycode });
            } else if (keyIndex == 1) {
              setCandidateOverride({ ...candidateOverride, replacement: candidateKeycode });
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

function ModifierCheckbox(props: { value: number; onChange: (value: number) => void }) {
  return (
    <FormGroup row>
      {["LCtrl", "LShift", "LAlt", "LGUI", "RCtrl", "Rshift", "RAlt", "RGUI"].map((mod, bitIdx) => {
        return (
          <FormControlLabel
            key={`${mod}`}
            label={mod}
            control={
              <Checkbox
                size="small"
                checked={(props.value & (1 << bitIdx)) > 0}
                onChange={(_event, checked) => {
                  props.onChange((props.value & ~(1 << bitIdx)) | (checked ? 1 << bitIdx : 0));
                }}
              ></Checkbox>
            }
          ></FormControlLabel>
        );
      })}
    </FormGroup>
  );
}
