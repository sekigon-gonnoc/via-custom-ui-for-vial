import { FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { useRef } from "react";

const isTauri = import.meta.env.TAURI_ENV_PLATFORM !== undefined;

export function KeyboardSelector(props: {
  deviceIndex: number | undefined;
  deviceList: { name: string; index: number; connection: "usb" | "ble" }[];
  onChange: (idx: number) => void;
  onOpen: () => void;
}) {
  const selectedValueRef = useRef<number | undefined>(props.deviceIndex);
  
  return (
    <FormControl variant="standard" sx={{ width: "100%", mb: 1, mt: 1 }}>
      <InputLabel>Select Keyboard</InputLabel>
      <Select
        value={props.deviceIndex || ""}
        label="select-keyboard"
        onChange={(e) => {
          console.log(e.target.value);
          const newValue = e.target.value as number;
          selectedValueRef.current = newValue; // Store the current selection
        }}
        onClose={(_) => {
          if (selectedValueRef.current !== undefined) {
            props.onChange(selectedValueRef.current);
          }
        }}
        onOpen={(_) => {
          props.onOpen();
        }}
      >
        {props.deviceList.map((device) => (
          <MenuItem
            key={device.index}
            value={device.index}
            sx={{ whiteSpace: "normal", wordBreak: "break-word" }}
          >
            <Typography noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
              {`${device.name} (${device.connection.toUpperCase()})`}
            </Typography>
          </MenuItem>
        ))}
        {!isTauri && navigator.hid === undefined ? (
          <></>
        ) : (
          <MenuItem key="new-device" value={-1} sx={{ display: isTauri ? "none" : "block" }}>
            Add New Keyboard(USB)
          </MenuItem>
        )}
        {isTauri || navigator.bluetooth === undefined ? (
          <></>
        ) : (
          <MenuItem key="new-device-ble" value={-2} sx={{ display: isTauri ? "none" : "block" }}>
            Connect by BLE
          </MenuItem>
        )}
      </Select>
    </FormControl>
  );
}
