import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

export function KeyboardSelector(props: {
  deviceIndex: number;
  deviceList: { name: string; index: number }[];
  onChange: (idx: number) => void;
}) {
  return (
    <FormControl variant="standard" sx={{ width: "100%", ml: 1, mb: 1, mt: 1 }}>
      <InputLabel>Select Keyboard</InputLabel>
      <Select
        value={props.deviceIndex}
        label="select-keyboard"
        onChange={(e) => props.onChange(e.target.value as number)}
      >
        {props.deviceList.map((device) => (
          <MenuItem key={device.name} value={device.index}>
            {device.name}
          </MenuItem>
        ))}
        <MenuItem key="new-device" value={-1}>
          Add New Keyboard
        </MenuItem>
      </Select>
    </FormControl>
  );
}
