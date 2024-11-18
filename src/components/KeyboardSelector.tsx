import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

const isTauri = import.meta.env.TAURI_ENV_PLATFORM !== undefined;

export function KeyboardSelector(props: {
  deviceIndex: number | undefined;
  deviceList: { name: string; index: number }[];
  onChange: (idx: number) => void;
  onOpen: () => void;
}) {
  return (
    <FormControl variant="standard" sx={{ width: "100%", ml: 1, mb: 1, mt: 1 }}>
      <InputLabel>Select Keyboard</InputLabel>
      <Select
        value={props.deviceIndex}
        label="select-keyboard"
        onChange={(e) => props.onChange(e.target.value as number)}
        onOpen={(_) => {
          props.onOpen();
        }}
      >
        {props.deviceList.map((device) => (
          <MenuItem key={device.index} value={device.index}>
            {device.name}
          </MenuItem>
        ))}
        <MenuItem key="new-device" value={-1} sx={{ display: isTauri ? "none" : "block" }}>
          Add New Keyboard
        </MenuItem>
      </Select>
    </FormControl>
  );
}
