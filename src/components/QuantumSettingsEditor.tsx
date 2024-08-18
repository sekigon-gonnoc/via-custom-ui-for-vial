import { Box, Button, Tab, Tabs } from "@mui/material";
import { useEffect, useState } from "react";
import { ViaKeyboard } from "../services/vialKeyboad";
import { MenuSectionProperties, ViaMenuItem } from "./ViaMenuItem";

const QuantumSettingDefinition = [
  {
    label: "Magic",
    content: [
      {
        type: "multiple-checkbox",
        label: "Magic",
        content: ["id-magic", 21, 2],
        options: [
          ["Swap Control CapsLock", 0],
          ["CapsLock to Control", 1],
          ["Swap LAlt LGUI", 2],
          [`Swap RAlt RGUI`, 3],
          ["No GUI", 4],
          ["Swap Grave Esc", 5],
          ["Swap Backslash Backspace", 6],
          ["Swap LCTL LGUI", 8],
          ["Swap RCtl RGUI", 9],
        ],
      },
    ],
  },
  {
    label: "Grave Escape",
    content: [
      {
        type: "multiple-checkbox",
        label: "Grave Escape Override",
        content: ["id-grave-escape", 1, 1],
        options: [
          "Send Esc if Alt is pressed",
          "Send Esc if Ctrl is pressed",
          "Send Esc if GUI is pressed",
          "Send Esc if Shift is pressed",
        ],
      },
    ],
  },

  {
    label: "Tap-Hold",
    content: [
      {
        type: "range",
        label: "Tapping term [ms]",
        content: ["id-tapping-term", 7, 2],
      },
      {
        type: "multiple-checkbox",
        label: "Tapping options",
        content: ["id-tapping", 8, 1],
        options: [
          "Permissive hold",
          "Ignore Mod Tap interrupt",
          "Tapping force hold",
          "Retro tapping",
        ],
      },
      {
        type: "range",
        label: "Tap code delay [ms]",
        content: ["id-tap-code-delay", 18, 2],
        options: [0, 500],
      },
      {
        type: "range",
        label: "Tap hold Caps delay [ms]",
        content: ["id-tap-hold-caps-delay", 19, 2],
        options: [0, 500],
      },
      {
        type: "range",
        label: "Tapping toggle",
        content: ["id-tapping-toggle", 20, 1],
        options: [0, 99],
      },
    ],
  },
  {
    label: "Auto Shift",
    content: [
      {
        type: "multiple-checkbox",
        label: "Auto Shift option",
        content: ["id-auto-shift", 3, 1],
        options: [
          "Enable",
          "Enable for modifiers",
          "No Auto Shift Special",
          "No Auto Shift Numeric",
          "No Auto Shift Alpha",
          "Enable keyrepeat",
          "Disable keyrepeat when timeout is exceeded",
        ],
      },
      {
        type: "range",
        label: "Auto Shift timeout",
        content: ["id-auto-shift-timeout", 4, 1],
        options: [0, 255],
      },
    ],
  },

  {
    label: "Combo",
    content: [
      {
        type: "range",
        label: "Combo term [ms]",
        content: ["id-combo-term", 2, 2],
        options: [0, 500],
      },
    ],
  },
  {
    label: "One Shot Keys",
    content: [
      {
        type: "range",
        label: "Tap toggle count",
        content: ["id-osk-tap-toggle", 5, 1],
        options: [0, 50],
      },
      {
        type: "range",
        label: "One shot key timeout [ms]",
        content: ["id-osk-tap-timeout", 6, 2],
        options: [0, 65535],
      },
    ],
  },
  {
    label: "Mouse Keys",
    content: [
      {
        type: "range",
        label: "Mouse key delay[ms]",
        content: ["id-mousekey-delay", 9, 2],
        options: [0, 500],
      },
      {
        type: "range",
        label: "Mouse key interval[ms]",
        content: ["id-mousekey-interval", 10, 2],
        options: [0, 500],
      },
      {
        type: "range",
        label: "Mouse key move delta",
        content: ["id-mousekey-move-delta", 11, 2],
        options: [0, 500],
      },
      {
        type: "range",
        label: "Mouse key max speed",
        content: ["id-mousekey-max-speed", 12, 2],
        options: [0, 500],
      },
      {
        type: "range",
        label: "Mouse key time to max[ms]",
        content: ["id-mousekey-time-to-max", 13, 2],
        options: [0, 500],
      },
      {
        type: "range",
        label: "Mouse key wheel delay[ms]",
        content: ["id-mousekey-wheel-delay", 14, 2],
        options: [0, 500],
      },
      {
        type: "range",
        label: "Mouse key wheel interval[ms]",
        content: ["id-mousekey-wheel-interval", 15, 2],
        options: [0, 500],
      },
      {
        type: "range",
        label: "Mouse key wheel max speed",
        content: ["id-mousekey-wheel-max-speed", 16, 2],
        options: [0, 500],
      },
      {
        type: "range",
        label: "Mouse key wheel time to max[ms]",
        content: ["id-mousekey-wheel-time-to-max", 17, 2],
        options: [0, 500],
      },
    ],
  },
];

export function QuantumSettingsEditor(props: {
  via: ViaKeyboard;
  onChange: (value: { [id: string]: number }) => void;
}) {
  const [tabValue, setTabValue] = useState(0);
  const [quantumValue, setQuantumValue] = useState<{ [id: string]: number }>({});

  useEffect(() => {
    console.log("read quantum values");

    const undefinedIds = QuantumSettingDefinition[tabValue].content
      .filter((v) => quantumValue[v.content[0]] === undefined)
      .map((v) => v.content[1] as number);
    const newValue = { ...quantumValue };
    undefinedIds.forEach((id) => {
      newValue[id] = 0;
    });
    props.onChange(newValue);
    setQuantumValue(newValue);

    navigator.locks.request("load-quantum-settings", async () => {
      const value = await props.via.GetQuantumSettingsValue(undefinedIds);
      const newValue = Object.entries(value).reduce(
        (acc, v) => {
          const id = QuantumSettingDefinition[tabValue].content.find((c) => {
            return c.content[1].toString() === v[0];
          });
          return {
            ...acc,
            [id?.content[0] ?? "id-unknown"]:
              v[1] & ((1 << (8 * ((id?.content[2] as number) ?? 2))) - 1),
          };
        },
        { ...quantumValue },
      );
      setQuantumValue(newValue);
      console.log(newValue);
    });
  }, [props.via, tabValue]);

  return (
    <>
      <Tabs
        value={tabValue}
        onChange={(_event, value) => setTabValue(value)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {QuantumSettingDefinition.map((menu) => (
          <Tab key={menu.label} label={menu.label}></Tab>
        ))}
      </Tabs>

      {QuantumSettingDefinition.map((_menu, idx) => (
        <Box key={idx} hidden={tabValue !== idx}>
          <ViaMenuItem
            {...(QuantumSettingDefinition[idx] as MenuSectionProperties)}
            customValues={quantumValue}
            onChange={(id, value) => {
              console.log(`update ${id} to ${value}`);
              const newValues = { ...quantumValue, [id[0]]: value };
              setQuantumValue(newValues);
              props.onChange(newValues);
            }}
          />
        </Box>
      ))}
    </>
  );
}

export function QuantumSettingsSaveButton(props: {
  via: ViaKeyboard;
  value: { [id: string]: number };
  connected: boolean;
}) {
  const sendQuantumSettings = (values: { [id: string]: number }) => {
    props.via.SetQuantumSettingsValue(
      Object.entries(values).reduce((acc, value) => {
        const idNum = QuantumSettingDefinition.map((def) => def.content)
          .map((def) => def.map((d) => d.content))
          .flat()
          .find((q) => q[0] === value[0])?.[1];
        return idNum !== undefined ? { ...acc, [idNum]: value[1] } : acc;
      }, {}),
    );
  };

  return (
    <Button
      sx={{
        width: "100%",
        ml: 1,
        mb: 1,
      }}
      variant="contained"
      color="primary"
      onClick={() => {
        console.log("Save");
        console.log(props.value);
        sendQuantumSettings(props.value);
      }}
    >
      Save
    </Button>
  );
}
