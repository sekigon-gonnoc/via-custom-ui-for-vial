import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Grid,
  Link,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Toolbar,
} from "@mui/material";
import * as Hjson from "hjson";
import { useEffect, useRef, useState } from "react";
import { match, P } from "ts-pattern";
import "./App.css";
import { KeymapEditor, KeymapProperties } from "./components/KeymapEditor";
import {
  QuantumSettingsEditor,
  QuantumSettingsSaveButton,
} from "./components/QuantumSettingsEditor";
import { MenuItemProperties, MenuSectionProperties, ViaMenuItem } from "./components/ViaMenuItem";
import init, { xz_decompress } from "./pkg";
import { DynamicEntryCount, ViaKeyboard, VialDefinition } from "./services/vialKeyboad";
import {
  VialKeyboardConfig,
  VialKeyboardGetAllConfig,
  VialKeyboardSetAllConfig,
} from "./services/vialKeyboardConfig";

if (!(navigator as any).hid) {
  alert("Please use chrome/edge");
}

const via = new ViaKeyboard();

function App() {
  const [vialJson, setVialJson] = useState<VialDefinition | undefined>(undefined);
  const [dynamicEntryCount, setDynamicEntryCount] = useState<DynamicEntryCount>({
    layer: 0,
    macro: 0,
    tapdance: 0,
    combo: 0,
    override: 0,
  });
  const [customMenus, setCustomMenus] = useState<MenuItemProperties[]>([]);
  const [activeMenu, setActiveMenu] = useState<
    | {
        menuType: "customMenu";
        menu: MenuSectionProperties;
      }
    | {
        menuType: "keymap";
        menu: KeymapProperties;
      }
    | {
        menuType: "quantum";
      }
  >();
  const [customValues, setCustomValues] = useState<{ [id: string]: number }>({});
  const [customValueId, setCustomValueId] = useState<[string, number, number, number?][]>([]);
  const [connected, setConnected] = useState(false);
  const [kbName, setKbName] = useState("");
  const [customEraseDialogOpen, setCustomEraseDialogOpen] = useState(false);
  const [quantumEraseDialogOpen, setQuantumEraseDialogOpen] = useState(false);
  const customFileInputRef = useRef<HTMLInputElement>(null);
  const vialFileInputRef = useRef<HTMLInputElement>(null);
  const [quantumValues, setQuantumValues] = useState<{ [id: string]: number }>({});

  useEffect(() => {
    // load wasm
    init();
  }, []);

  const getCustomValues = async (_customValueId: typeof customValueId) => {
    const buffer = await via.GetCustomValue(_customValueId.map((v) => v.slice(1) as number[]));
    const customValues: { [id: string]: number } = buffer.reduce((acc, value, idx) => {
      return { ...acc, [_customValueId[idx][0]]: value };
    }, {});
    setCustomValues(customValues);
    console.log(customValues);
  };

  const onOpenClick = async () => {
    await via.Close();
    await via.Open(
      () => {
        setConnected(true);
      },
      () => {
        setVialJson(undefined);
        setCustomMenus([]);
        setActiveMenu(undefined);
        setCustomValues({});
        setConnected(false);
        setKbName("");
      },
    );
    const version = await via.GetProtocolVersion();
    await via.GetVialKeyboardId(); // enable vial mode of BMP
    console.log(`via protocol version:${version}`);
    const compressed = await via.GetVialCompressedDefinition();

    let decompressed: Uint8Array;
    try {
      decompressed = xz_decompress(compressed);
    } catch {
      via.Close();
      alert("Failed to open the keyboard");
      return;
    }

    const decoder = new TextDecoder();
    const jsonText = decoder.decode(decompressed);
    console.log(jsonText);
    const parsed = Hjson.parse(jsonText);
    console.log(parsed);
    setVialJson(parsed);
    setCustomMenus(parsed?.menus ?? []);
    setKbName(parsed?.name ?? via.GetHidName());

    const dynamicEntryCount = await via.GetDynamicEntryCountAll();
    setDynamicEntryCount(dynamicEntryCount);

    const customValueId = (parsed.menus as MenuItemProperties[]).flatMap((top) =>
      top.content.reduce((prev: [string, number, number, number?][], section) => {
        section.content.forEach((content) => {
          if ("type" in content) {
            prev.push(content.content);
          } else {
            if (Array.isArray(content.content)) {
              content.content.forEach((c) => prev.push(c.content));
            } else {
              prev.push(content.content);
            }
          }
        });
        return prev;
      }, []),
    );
    setCustomValueId(customValueId);
    getCustomValues(customValueId);
  };

  const onVialSaveClick = async () => {
    if (vialJson === undefined) return;
    downloadData(
      JSON.stringify(
        await VialKeyboardGetAllConfig(via, vialJson, dynamicEntryCount),
        (_key, value) => (typeof value === "bigint" ? value.toString() : value),
        4,
      ),
      `${kbName}-vial-setting.json`,
    );
  };

  const onVialUploadJsonClick = async () => {
    vialFileInputRef.current?.click();
  };

  const onVialJsonUploaded = async (json: string) => {
    try {
      if (vialJson === undefined) return;
      const parsedJson = JSON.parse(json) as VialKeyboardConfig;
      try {
        await VialKeyboardSetAllConfig(via, parsedJson, vialJson, dynamicEntryCount, customValueId);
      } catch (e) {
        console.error(e);
        alert("Failed to write configurations");
      }

      await getCustomValues(customValueId);
      setVialJson({ ...vialJson! });
    } catch (error) {
      console.error("Error parsing JSON:", error);
      alert("Invalid JSON file.");
    }
  };

  const onCustomSaveClick = async () => {
    for (const element of customValueId) {
      await via.SetCustomValue(element.slice(1) as number[], customValues[element[0]]);
      await via.SaveCustomValue(element.slice(1) as number[]);
    }

    getCustomValues(customValueId);
  };

  const onCustomEraseClick = async () => {
    setCustomEraseDialogOpen(true);
  };

  const onDialogClose = () => {
    setCustomEraseDialogOpen(false);
  };

  const onDialogOkClick = async () => {
    setCustomEraseDialogOpen(false);
    await via.ResetEeprom();
    await getCustomValues(customValueId);
  };

  const downloadData = (data: any, name: string) => {
    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob([data]));
    link.setAttribute("href", url);
    link.setAttribute("download", name);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const onDownloadJsonClick = async () => {
    downloadData(JSON.stringify(customValues, null, 4), `${kbName}_custom_config.json`);
  };

  const onUploadJsonClick = async () => {
    customFileInputRef.current?.click();
  };

  const onCustomJsonUploaded = async (json: string) => {
    try {
      const parsedJson = Hjson.parse(json);
      console.log(parsedJson);
      const loadedCustomValues = { ...customValues, ...parsedJson };
      setCustomValues(loadedCustomValues);
      for (const element of customValueId) {
        await via.SetCustomValue(element.slice(1) as number[], loadedCustomValues[element[0]]);
      }
    } catch (error) {
      console.error("Error parsing JSON:", error);
      alert("Invalid JSON file.");
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    handler: (json: string) => void,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        handler(e.target?.result as string);
      };
      reader.readAsText(file);
    }
    event.target.value = "";
  };

  return (
    <>
      <Grid container spacing={2}>
        <Grid item xs={3}>
          <Toolbar>
            <Button onClick={onOpenClick} variant="contained">
              Open
            </Button>
            <ListSubheader>{kbName}</ListSubheader>
          </Toolbar>
          <Divider />
          <List>
            <div style={{ display: connected ? "block" : "none" }}>
              <ListSubheader>Keymap</ListSubheader>
              <List disablePadding>
                <ListItemButton
                  onClick={() => {
                    setActiveMenu({ menuType: "keymap", menu: vialJson! });
                  }}
                >
                  <ListItemText primary="Keymap" />
                </ListItemButton>
              </List>
              <Grid container rowSpacing={1} columnSpacing={2}>
                <Grid item xs={12} sm={6}>
                  <Button
                    sx={{
                      width: "100%",
                      ml: 1,
                      mb: 1,
                    }}
                    variant="contained"
                    color="primary"
                    onClick={onVialSaveClick}
                  >
                    DL json
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    sx={{
                      width: "100%",
                    }}
                    variant="contained"
                    color="primary"
                    onClick={onVialUploadJsonClick}
                  >
                    UP json
                  </Button>
                </Grid>
              </Grid>
              <input
                type="file"
                accept=".json"
                ref={vialFileInputRef}
                style={{ display: "none" }}
                onChange={(event) => {
                  handleFileChange(event, onVialJsonUploaded);
                }}
              />
            </div>
            <Divider />
            <div style={{ display: connected ? "block" : "none" }}>
              <ListSubheader>Quantum settings</ListSubheader>
              <List disablePadding>
                <ListItemButton
                  onClick={() => {
                    setActiveMenu({ menuType: "quantum" });
                  }}
                >
                  <ListItemText primary="Quantum" />
                </ListItemButton>

                <Grid container rowSpacing={1} columnSpacing={2}>
                  <Grid item xs={12} sm={6}>
                    <QuantumSettingsSaveButton
                      via={via}
                      value={quantumValues}
                      connected={connected}
                    ></QuantumSettingsSaveButton>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Button
                      sx={{
                        width: "100%",
                      }}
                      variant="contained"
                      color="error"
                      onClick={() => {
                        setQuantumEraseDialogOpen(true);
                      }}
                    >
                      Erase
                    </Button>
                  </Grid>
                </Grid>
              </List>
            </div>
            <Divider />
            {customMenus.map((top) => (
              <Box key={top.label}>
                <ListSubheader> {top.label}</ListSubheader>
                <List disablePadding>
                  {top.content.map((menu) => (
                    <ListItemButton
                      key={menu.label}
                      onClick={() => {
                        setActiveMenu({ menuType: "customMenu", menu: menu });
                      }}
                    >
                      <ListItemText primary={menu.label} />
                    </ListItemButton>
                  ))}
                </List>
                <Divider />
              </Box>
            ))}
          </List>
          <Box hidden={customMenus.length == 0}>
            <Grid container rowSpacing={1} columnSpacing={2}>
              <Grid item xs={12} sm={6}>
                <Button
                  sx={{
                    width: "100%",
                    ml: 1,
                  }}
                  variant="contained"
                  color="primary"
                  onClick={onCustomSaveClick}
                >
                  Save
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  sx={{
                    width: "100%",
                  }}
                  variant="contained"
                  color="error"
                  onClick={onCustomEraseClick}
                >
                  Erase
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  sx={{
                    width: "100%",
                    ml: 1,
                    mb: 1,
                  }}
                  variant="contained"
                  color="primary"
                  onClick={onDownloadJsonClick}
                >
                  DL json
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  sx={{
                    width: "100%",
                  }}
                  variant="contained"
                  color="primary"
                  onClick={onUploadJsonClick}
                >
                  UP json
                </Button>
                <input
                  type="file"
                  accept=".json"
                  ref={customFileInputRef}
                  style={{ display: "none" }}
                  onChange={(event) => {
                    handleFileChange(event, onCustomJsonUploaded);
                  }}
                />
              </Grid>
            </Grid>
          </Box>
          <Divider />
          <Link href="https://github.com/sekigon-gonnoc/via-custom-ui-for-vial" target="_blank">
            Usage
          </Link>
        </Grid>
        <Grid item xs={8}>
          {match(activeMenu)
            .with(undefined, () => <></>)
            .with({ menuType: "customMenu" }, (menu) => (
              <ViaMenuItem
                {...menu.menu}
                customValues={customValues}
                onChange={async (id, value) => {
                  setCustomValues({ ...customValues, [id[0]]: value });
                  await via.SetCustomValue(id.slice(1) as number[], value);
                }}
              ></ViaMenuItem>
            ))
            .with({ menuType: "quantum" }, () => {
              return (
                <QuantumSettingsEditor
                  via={via}
                  onChange={(value) => {
                    setQuantumValues(value);
                  }}
                ></QuantumSettingsEditor>
              );
            })
            .with(P._, () => <></>)
            .exhaustive()}
          {vialJson === undefined ? (
            <></>
          ) : (
            <>
              <div hidden={activeMenu?.menuType !== "keymap"}>
                <KeymapEditor
                  keymap={vialJson!}
                  via={via}
                  dynamicEntryCount={dynamicEntryCount}
                ></KeymapEditor>
              </div>
            </>
          )}
        </Grid>
        <Grid item xs={1}></Grid>
      </Grid>
      <Dialog open={customEraseDialogOpen} onClose={onDialogClose}>
        <DialogContent>Erase all custom settings?</DialogContent>
        <DialogActions>
          <Button color="error" onClick={onDialogClose}>
            Cancel
          </Button>
          <Button color="primary" onClick={onDialogOkClick}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={quantumEraseDialogOpen}
        onClose={() => {
          setQuantumEraseDialogOpen(false);
        }}
      >
        <DialogContent>Erase all quantum settings?</DialogContent>
        <DialogActions>
          <Button
            color="error"
            onClick={() => {
              setQuantumEraseDialogOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            onClick={async () => {
              setQuantumEraseDialogOpen(false);
              await via.EraseQuantumSettingsValue();
              setActiveMenu(undefined);
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default App;
