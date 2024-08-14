import { useEffect, useState, useRef } from "react";
import init, { xz_decompress } from "./pkg";
import { ViaKeyboard } from "./services/vialKeyboad";
import * as Hjson from "hjson";
import { ViaMenuItem, MenuSectionProperties } from "./components/ViaMenuItem";
import {
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Grid,
  ListSubheader,
  Link,
  Dialog,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { MenuItemProperties } from "./components/ViaMenuItem";
import { KeymapEditor, KeymapProperties } from "./components/KeymapEditor";
import { match, P } from "ts-pattern";

if (!(navigator as any).hid) {
  alert("Please use chrome/edge");
}

const via = new ViaKeyboard();

function App() {
  const [vialJson, setVialJson] = useState(undefined);
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
  >();
  const [customValues, setCustomValues] = useState<{ [id: string]: number }>(
    {}
  );
  const [customValueId, setCustomValueId] = useState<
    [string, number, number, number?][]
  >([]);
  const [connected, setConnected] = useState(false);
  const [kbName, setKbName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // load wasm
    init();
  }, []);

  const getCustomValues = async (_customValueId: typeof customValueId) => {
    const customValues: { [id: string]: number } = {};
    for (const element of _customValueId) {
      customValues[element[0]] = await via.GetCustomValue(
        element.slice(1) as number[]
      );
    }
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
      }
    );
    const version = await via.GetProtocolVersion();
    await via.GetVialKeyboardId();
    console.log(`protocol version:${version}`);
    const compressed = await via.GetVialCompressedDefinition();
    const decompressed = xz_decompress(compressed);
    const decoder = new TextDecoder();
    const jsonText = decoder.decode(decompressed);
    console.log(jsonText);
    const parsed = Hjson.parse(jsonText);
    console.log(parsed);
    setVialJson(parsed);
    setCustomMenus(parsed?.menus ?? []);
    setKbName(parsed?.name ?? via.GetHidName());

    const customValueId = (parsed.menus as MenuItemProperties[]).flatMap(
      (top) =>
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
        }, [])
    );
    setCustomValueId(customValueId);
    getCustomValues(customValueId);
  };

  const onSaveClick = async () => {
    for (const element of customValueId) {
      await via.SetCustomValue(element.slice(1) as number[], customValues[element[0]]);
      await via.SaveCustomValue(element.slice(1) as number[]);
    }

    getCustomValues(customValueId);
  };

  const onEraseClick = async () => {
    setDialogOpen(true);
  };

  const onDialogClose = () => {
    setDialogOpen(false);
  };

  const onDialogOkClick = async () => {
    setDialogOpen(false);
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
    downloadData(
      JSON.stringify(customValues, null, 4),
      `${kbName}_custon_config.json`
    );
  };

  const onUploadJsonClick = async () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          const parsedJson = Hjson.parse(result);
          console.log(parsedJson);
          const loadedCustomValues = {...customValues, ...parsedJson};
          setCustomValues(loadedCustomValues);
          for (const element of customValueId) {
            await via.SetCustomValue(
              element.slice(1) as number[],
              loadedCustomValues[element[0]]
            );
          }
        } catch (error) {
          console.error("Error parsing JSON:", error);
          alert("Invalid JSON file.");
        }
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
            </div>
            <Divider />
            {customMenus.map((top) => (
              <>
                <ListSubheader> {top.label}</ListSubheader>
                <List disablePadding>
                  {top.content.map((menu) => (
                    <ListItemButton
                      onClick={() => {
                        setActiveMenu({ menuType: "customMenu", menu: menu });
                      }}
                    >
                      <ListItemText primary={menu.label} />
                    </ListItemButton>
                  ))}
                </List>
                <Divider />
              </>
            ))}
          </List>
          <Grid container rowSpacing={1} columnSpacing={2}>
            <Grid item xs={12} sm={6}>
              <Button
                sx={{
                  display: connected ? "block" : "none",
                  width: "100%",
                  ml: 1,
                }}
                variant="contained"
                color="primary"
                onClick={onSaveClick}
              >
                Save
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                sx={{
                  display: connected ? "block" : "none",
                  width: "100%",
                }}
                variant="contained"
                color="error"
                onClick={onEraseClick}
              >
                Erase
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                sx={{
                  display: connected ? "block" : "none",
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
                  display: connected ? "block" : "none",
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
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </Grid>
          </Grid>
          <Divider />
          <Link
            href="https://github.com/sekigon-gonnoc/via-custom-ui-for-vial"
            target="_blank"
          >
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
            .with({ menuType: "keymap" }, (menu) => (
              <KeymapEditor {...menu.menu} via={via}></KeymapEditor>
            ))
            .exhaustive()}
        </Grid>
        <Grid item xs={1}></Grid>
      </Grid>
      <Dialog open={dialogOpen} onClose={onDialogClose}>
        <DialogContent>Erase all settings?</DialogContent>
        <DialogActions>
          <Button color="error" onClick={onDialogClose}>
            Cancel
          </Button>
          <Button color="primary" onClick={onDialogOkClick}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default App;
