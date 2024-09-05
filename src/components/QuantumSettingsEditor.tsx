import { Box, Button, CircularProgress, Tab, Tabs } from "@mui/material";
import { useEffect, useState } from "react";
import { QuantumSettingDefinition } from "../services/quantumSettings";
import { ViaKeyboard } from "../services/vialKeyboad";
import { MenuSectionProperties, ViaMenuItem } from "./ViaMenuItem";

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
  const [writing, setWriting] = useState(false);
  const sendQuantumSettings = async (values: { [id: string]: number }) => {
    await props.via.SetQuantumSettingsValue(
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
      onClick={async () => {
        console.log("Save");
        console.log(props.value);
        setWriting(true);
        try {
          await sendQuantumSettings(props.value);
        } catch (e) {
          console.error(e);
        }
        setWriting(false);
      }}
    >
      {!writing ? "Save quantum" : <CircularProgress color="inherit" size={20} />}
    </Button>
  );
}
