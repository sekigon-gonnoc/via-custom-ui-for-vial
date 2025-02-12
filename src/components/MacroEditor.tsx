import { ArrowDownward, ArrowUpward, Delete } from "@mui/icons-material";
import { Box, Button, IconButton, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { ViaKeyboard } from "../services/vialKeyboad";
import { DefaultQmkKeycode, KeycodeConverter } from "./keycodes/keycodeConverter";
import { EditableKey, KeymapKeyPopUp } from "./KeymapEditor";

export function MacroEditor(props: {
  via: ViaKeyboard;
  keycodeConverter: KeycodeConverter;
  macroIndex: number;
  macroCount: number;
  onBack: () => void;
}) {
  const [macroData, setMacroData] = useState<{ [id: number]: number[] }>({});

  useEffect(() => {
    navigator.locks.request("load-macro", async () => {
      if (props.macroIndex < 0 || props.macroIndex >= props.macroCount) return;
      const newMacro = (await getMacros(props.macroIndex)) ?? macroData;
      setMacroData(newMacro);
    });
  }, [props.macroIndex, props.macroCount]);

  const getMacros = async (macroIndex: number) => {
    if (macroIndex < 0 || macroIndex >= props.macroCount) return macroData;
    const fetchedMacroIndex = Object.keys(macroData)
      .map((k) => parseInt(k))
      .sort((a, b) => a - b);
    if (macroIndex != fetchedMacroIndex.findIndex((k) => k === macroIndex)) {
      const readOffset = fetchedMacroIndex.reduce(
        (acc, num, idx) => {
          return num === idx
            ? { id: idx + 1, offset: acc.offset + macroData[idx].length + 1 }
            : acc;
        },
        { id: 0, offset: 0 },
      );
      const readLength = 28 * 4;
      const macroArray: number[][] = [[]];

      while (readOffset.id + macroArray.length <= macroIndex + 1) {
        const buffer = await props.via.GetMacroBuffer(readOffset.offset, readLength);
        buffer.reduce((acc, num) => {
          if (num === 0) {
            acc.push([]);
          } else {
            acc[acc.length - 1].push(num);
          }
          return acc;
        }, macroArray);
        readOffset.offset += readLength;
      }
      macroArray.pop();

      const newMacro = { ...macroData };
      macroArray.forEach((macro, idx) => {
        if (readOffset.id + idx < props.macroCount) newMacro[readOffset.id + idx] = macro;
      });

      console.log(newMacro);

      return newMacro;
    }
  };

  const sendMacros = (offset: number, data: number[]) => {
    props.via.SetMacroBuffer(offset, data);
  };

  const saveMacros = async (actions: number[][], macroIndex: number) => {
    const actionBuffer = actions
      .map((action) => {
        if (action[0] == 1) {
          if (action[1] < 4) {
            if (action[2] == 0) return [];
            else if (action[2] > 0xff) {
              return [
                action[0],
                action[1] + 4,
                action[2] & 0xff,
                action[2] >> 8,
              ];
            } else {
              return [action[0], action[1], action[2] & 0xff];
            }
          } else if (action[1] == 4) {
            const upperbyte = Math.floor(action[2] / 255) + 1;
            return [action[0], action[1], action[2] - (upperbyte - 1) * 255 + 1, upperbyte];
          } else {
            if (action[2] == 0) return [];
            else if (action[2] > 0xff) {
              return [action[0], action[1], action[2] & 0xff, action[2] >> 8];
            } else {
              return [action[0], action[1] - 4, action[2] & 0xff];
            }
          }
        } else {
          return action;
        }
      })
      .flat();

    const newMacroData = { ...macroData, ...(await getMacros(props.macroCount - 1)) };
    newMacroData[macroIndex] = actionBuffer;

    const writeOffset = Object.entries(macroData)
      .filter((m) => parseInt(m[0]) < macroIndex)
      .reduce((acc, m) => acc + m[1].length + 1, 0);

    const writeData = Object.entries(newMacroData)
      .filter((m) => parseInt(m[0]) >= macroIndex)
      .reduce((acc, m) => {
        acc.push(...m[1], 0);
        return acc;
      }, [] as number[]);
    console.log(`write macro data. offset:${writeOffset} length:${writeData.length}`);
    console.log(writeData);
    sendMacros(writeOffset, writeData);

    setMacroData(newMacroData);
  };

  return (
    <Box>
      <Box>{`Edit macro${props.macroIndex}`}</Box>
      <MacroEntry
        buffer={macroData[props.macroIndex] ?? []}
        keycodeConverter={props.keycodeConverter}
        onSave={(actions: number[][]) => saveMacros(actions, props.macroIndex)}
        onBack={props.onBack}
      ></MacroEntry>
    </Box>
  );
}

function MacroEntry(props: {
  buffer: number[];
  keycodeConverter: KeycodeConverter;
  onSave: (actions: number[][]) => void;
  onBack: () => void;
}) {
  const [actions, setActions] = useState<number[][]>([[]]);
  const [popupOpen, setpopupOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | undefined>(undefined);
  const [candidateKeycode, setCandidateKeycode] = useState(DefaultQmkKeycode);
  const [focusedAction, setFocusedAction] = useState(0);

  useEffect(() => {
    setActions(getActions(props.buffer));
  }, [props.buffer]);

  const getActions = (buffer: number[]) => {
    const newActions: number[][] = [[]];
    let idx = 0;
    while (idx < buffer.length) {
      if (buffer[idx] == 1) {
        if (newActions[newActions.length - 1].length == 0) {
          newActions.pop();
        }
        newActions.push([buffer[idx]]);
        idx += 1;
        if (1 <= buffer[idx] && buffer[idx] <= 3) {
          const keycode = buffer[idx + 1];
          newActions[newActions.length - 1].push(buffer[idx], keycode);
          idx += 2;
          newActions.push([]);
        } else if (buffer[idx] == 4) {
          const delay = buffer[idx + 1] - 1 + (buffer[idx + 2] - 1) * 255;
          newActions[newActions.length - 1].push(buffer[idx], delay);
          idx += 3;
          newActions.push([]);
        } else if (5 <= buffer[idx] && buffer[idx] <= 7) {
          const keycode = buffer[idx + 1] | (buffer[idx + 2] << 8);
          newActions[newActions.length - 1].push(buffer[idx], keycode);
          idx += 3;
          newActions.push([]);
        }
      } else {
        newActions[newActions.length - 1].push(buffer[idx]);
        idx += 1;
      }
    }
    if (newActions[newActions.length - 1].length == 0) newActions.pop();
    return newActions;
  };

  return (
    <>
      {actions.map((action, idx) => {
        return (
          <Stack key={idx} direction={"row"} mt={1}>
            <IconButton onClick={() => setActions(actions.filter((_, id) => id !== idx))}>
              <Delete></Delete>
            </IconButton>
            <IconButton
              onClick={() => {
                if (idx > 0) {
                  setActions(
                    actions.map((action, id) =>
                      id == idx - 1 ? actions[idx] : id == idx ? actions[idx - 1] : action,
                    ),
                  );
                }
              }}
            >
              <ArrowUpward></ArrowUpward>
            </IconButton>
            <IconButton
              onClick={() => {
                if (idx < actions.length - 1) {
                  setActions(
                    actions.map((action, id) =>
                      id == idx + 1 ? actions[idx] : id == idx ? actions[idx + 1] : action,
                    ),
                  );
                }
              }}
            >
              <ArrowDownward></ArrowDownward>
            </IconButton>
            {action.length < 1 || action[0] != 1 || action[1] > 7 ? (
              <TextField
                value={new TextDecoder("ascii").decode(Uint8Array.from(action))}
                fullWidth
                onChange={(event) => {
                  const asciiArray = [...Array(event.target.value.length)].reduce((acc, _, idx) => {
                    const charcode = event.target.value.charCodeAt(idx);
                    if (charcode <= 0x7f) acc.push(charcode);
                    return acc;
                  }, [] as number[]);
                  setActions(actions.map((action, id) => (idx == id ? asciiArray : action)));
                }}
              ></TextField>
            ) : action[1] == 4 ? (
              <TextField
                type="number"
                label="Delay[ms]"
                InputLabelProps={{ shrink: true }}
                value={action[2]}
                onChange={(event) => {
                  setActions(
                    actions.map((action, id) =>
                      idx == id
                        ? [action[0], action[1], parseInt("0" + event.target.value)]
                        : action,
                    ),
                  );
                }}
              ></TextField>
            ) : (
              <>
                <EditableKey
                  keycode={props.keycodeConverter.convertIntToKeycode(action[2])}
                  onKeycodeChange={(keycode) =>
                    setActions(
                      actions.map((action, id) =>
                        idx == id ? [action[0], action[1], keycode.value] : action,
                      ),
                    )
                  }
                  onClick={(target) => {
                    setpopupOpen(true);
                    setAnchorEl(target);
                    setCandidateKeycode(props.keycodeConverter.convertIntToKeycode(action[2]));
                    setFocusedAction(idx);
                  }}
                ></EditableKey>
                <div className="macro-item-label">
                  {{ 1: "Tap", 2: "Down", 3: "Up", 5: "Tap", 6: "Down", 7: "Up" }[action[1]]}
                </div>
              </>
            )}
          </Stack>
        );
      })}
      <KeymapKeyPopUp
        open={popupOpen}
        keycode={candidateKeycode}
        keycodeconverter={props.keycodeConverter}
        anchor={anchorEl}
        onClickAway={() => {
          if (popupOpen) {
            setpopupOpen(false);
            setAnchorEl(undefined);
            setActions(
              actions.map((action, id) =>
                focusedAction == id ? [action[0], action[1], candidateKeycode.value] : action,
              ),
            );
          }
        }}
        onChange={(event) => {
          setCandidateKeycode(event.keycode);
        }}
      ></KeymapKeyPopUp>
      <div>
        <Button onClick={() => setActions([...actions, []])}>+TEXT</Button>
        <Button onClick={() => setActions([...actions, [1, 1, 0]])}>+TAP</Button>
        <Button onClick={() => setActions([...actions, [1, 2, 0]])}>+DOWN</Button>
        <Button onClick={() => setActions([...actions, [1, 3, 0]])}>+UP</Button>
        <Button onClick={() => setActions([...actions, [1, 4, 0]])}>+DELAY</Button>
      </div>
      <div>
        <Button onClick={() => setActions(getActions(props.buffer))}>Revert</Button>
        <Button onClick={() => props.onBack()}>BACK</Button>
        <Button onClick={() => props.onSave(actions)} variant="outlined">
          SAVE
        </Button>
      </div>
    </>
  );
}
