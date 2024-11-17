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
} from "@mui/material";
import * as Hjson from "hjson";
import { useEffect, useRef, useState } from "react";
import { match, P } from "ts-pattern";
import "./App.css";
import { KeyboardSelector } from "./components/KeyboardSelector";
import { KeymapEditor, KeymapProperties } from "./components/KeymapEditor";
import { QuantumSettingsEditor } from "./components/QuantumSettingsEditor";
import { MenuItemProperties, MenuSectionProperties, ViaMenuItem } from "./components/ViaMenuItem";
import init, { xz_decompress } from "./pkg";
import { QuantumSettingDefinition } from "./services/quantumSettings";
import { DynamicEntryCount, ViaKeyboard, VialDefinition } from "./services/vialKeyboad";
import {
  VialKeyboardConfig,
  VialKeyboardGetAllConfig,
  VialKeyboardSetAllConfig,
} from "./services/vialKeyboardConfig";

const isTauri = import.meta.env.TAURI_PLATFORM !== undefined;

if (!isTauri && !(navigator as any).hid) {
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
  const [loading, setLoading] = useState(false);
  const [kbName, setKbName] = useState("");
  const [customEraseDialogOpen, setCustomEraseDialogOpen] = useState(false);
  const [quantumEraseDialogOpen, setQuantumEraseDialogOpen] = useState(false);
  const vialFileInputRef = useRef<HTMLInputElement>(null);
  const [quantumValues, setQuantumValues] = useState<{ [id: string]: number }>({});
  const [deviceList, setDeviceList] = useState<{ name: string; index: number; opened: boolean }[]>(
    [],
  );
  const [deviceIndex, setDeviceIndex] = useState<number | undefined>(undefined);

  useEffect(() => {
    // load wasm
    init();
    (async () => {
      setDeviceList(await updateDeviceList());
    })();
  }, []);

  const updateDeviceList = async () => {
    return (await via.GetDeviceList()).map((d) => {
      return {
        name: `${d.name}(${("0000" + d.vid.toString(16)).slice(-4)}:${("0000" + d.pid.toString(16)).slice(-4)})`,
        index: d.index,
        opened: d.opened,
      };
    });
  };

  const getCustomValues = async (_customValueId: typeof customValueId) => {
    const buffer = await via.GetCustomValue(_customValueId.map((v) => v.slice(1) as number[]));
    const customValues: { [id: string]: number } = buffer.reduce((acc, value, idx) => {
      return { ...acc, [_customValueId[idx][0]]: value };
    }, {});
    setCustomValues(customValues);
    console.log(customValues);
  };

  const openKeyboard = async (deviceIndex: number) => {
    await via.Close();
    await via.Open(
      deviceIndex ?? -1,
      () => {
        setLoading(true);
      },
      () => {
        setVialJson(undefined);
        setCustomMenus([]);
        setActiveMenu(undefined);
        setCustomValues({});
        setConnected(false);
        setLoading(false);
        setKbName("");
      },
    );

    const deviceList = await updateDeviceList();
    setDeviceList(deviceList);
    const newIdx = deviceList.find((d) => d.opened)?.index;
    setDeviceIndex(newIdx);

    try {
      const version = await via.GetProtocolVersion();
      await via.GetVialKeyboardId(); // enable vial mode of BMP
      console.log(`via protocol version:${version}`);
    } catch {
      via.Close();
      alert("Failed to open the keyboard");
      setLoading(false);
      return;
    }

    let decompressed: Uint8Array;
    try {
      const compressed = await via.GetVialCompressedDefinition();
      decompressed = xz_decompress(compressed);
    } catch {
      via.Close();
      alert("Failed to open the keyboard");
      setLoading(false);
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

    const customValueId = ((parsed?.menus ?? []) as MenuItemProperties[]).flatMap((top) =>
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
    await getCustomValues(customValueId);

    setConnected(true);
    setLoading(false);
  };

  const onVialSaveClick = async () => {
    if (vialJson === undefined) return;
    try {
      setLoading(true);
      downloadData(
        JSON.stringify(
          await VialKeyboardGetAllConfig(via, vialJson, dynamicEntryCount),
          (_key, value) => (typeof value === "bigint" ? value.toString() : value),
          4,
        ),
        `${kbName}-vial-setting.json`,
      );
    } finally {
      setLoading(false);
    }
  };

  const onVialUploadJsonClick = async () => {
    vialFileInputRef.current?.click();
  };

  const onVialJsonUploaded = async (json: string) => {
    try {
      if (vialJson === undefined) return;
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const onQuantumSaveClick = async () => {
    try {
      setLoading(true);
      await via.SetQuantumSettingsValue(
        Object.entries(quantumValues).reduce((acc, value) => {
          const idNum = QuantumSettingDefinition.map((def) => def.content)
            .map((def) => def.map((d) => d.content))
            .flat()
            .find((q) => q[0] === value[0])?.[1];
          return idNum !== undefined ? { ...acc, [idNum]: value[1] } : acc;
        }, {}),
      );
    } finally {
      setLoading(false);
    }
  };

  const onCustomSaveClick = async () => {
    try {
      setLoading(true);
      for (const element of customValueId) {
        await via.SetCustomValue(element.slice(1) as number[], customValues[element[0]]);
        await via.SaveCustomValue(element.slice(1) as number[]);
      }

      getCustomValues(customValueId);
    } finally {
      setLoading(false);
    }
  };

  const onCustomEraseClick = async () => {
    setCustomEraseDialogOpen(true);
  };

  const onDialogClose = () => {
    setCustomEraseDialogOpen(false);
  };

  const onDialogOkClick = async () => {
    setCustomEraseDialogOpen(false);
    try {
      setLoading(true);
      await via.ResetEeprom();
      await getCustomValues(customValueId);
    } finally {
      setLoading(false);
    }
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
      <Dialog open={loading}>
        <DialogContent>Loading...</DialogContent>
      </Dialog>
      <Grid container spacing={2}>
        <Grid item xs={3}>
          <Box>
            <KeyboardSelector
              deviceIndex={deviceIndex ?? -2}
              deviceList={deviceList}
              onChange={(idx) => openKeyboard(idx)}
            />
          </Box>
          <Divider />
          <ListSubheader>{kbName}</ListSubheader>
          <Box hidden={!connected}>
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
                  DL SETTING
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
                  UP SETTING
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
          </Box>
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
                    <Button
                      sx={{
                        width: "100%",
                        ml: 1,
                        mb: 1,
                      }}
                      variant="contained"
                      color="primary"
                      onClick={() => {
                        onQuantumSaveClick();
                      }}
                    >
                      Save quantum
                    </Button>
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
                      Erase quantum
                    </Button>
                  </Grid>
                </Grid>
              </List>
            </div>
            <Divider />
            <Box hidden={customMenus.length == 0}>
              <ListSubheader>Custom settings</ListSubheader>
            </Box>
            <Box sx={{ ml: 2 }}>
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
            </Box>
          </List>
          <Box hidden={customMenus.length == 0}>
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
                  onClick={onCustomSaveClick}
                >
                  Save custom
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  sx={{
                    width: "100%",
                    mb: 1,
                  }}
                  variant="contained"
                  color="error"
                  onClick={onCustomEraseClick}
                >
                  Erase custom
                </Button>
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
              setLoading(true);
              try {
                await via.EraseQuantumSettingsValue();
              } finally {
                setLoading(false);
              }
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
