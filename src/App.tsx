import { useEffect, useState } from "react";
import init, { xz_decompress } from "./pkg";
import { ViaKeyboard } from "./services/vialKeyboad";
import * as Hjson from "hjson";
import { ViaMenuItem, MenuSectionProperties } from "./ViaMenuItem";
import {
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Grid,
  ListSubheader,
  Stack,
  Link,
} from "@mui/material";
import { MenuItemProperties } from "./ViaMenuItem";

if (!(navigator as any).hid) {
  alert("Please use chrome/edge");
}

const via = new ViaKeyboard();

function App() {
  const [customMenus, setCustomMenus] = useState<MenuItemProperties[]>([]);
  const [activeMenu, setActiveMenu] = useState<MenuSectionProperties>();
  const [customValues, setCustomValues] = useState<{ [id: string]: number }>(
    {}
  );
  const [customValueId, setCustomValueId] = useState<
    [string, number, number, number?][]
  >([]);
  const [connected, setConnected] = useState(false);
  const [kbName, setKbName] = useState("");

  useEffect(() => {
    // load wasm
    init();
  }, []);

  const getCustomValues = async (_customValueId:typeof customValueId) => {
    const customValues: { [id: string]: number } = {};
    for (const element of _customValueId) {
      customValues[element[0]] = await via.GetCustomValue(
        element.slice(1) as number[]
      );
    }
    setCustomValues(customValues);
    console.log(customValues);
  }

  const onOpenClick = async () => {
    await via.Close();
    await via.Open(
      () => {
        setConnected(true);
      },
      () => {
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
      await via.SaveCustomValue(element.slice(1) as number[]);
    }

    getCustomValues(customValueId);
  };

  const onEraseClick = async () => {
    await via.ResetEeprom();
  }

  return (
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
          {customMenus.map((top) => (
            <>
              <ListSubheader> {top.label}</ListSubheader>
              <List disablePadding>
                {top.content.map((menu) => (
                  <ListItemButton
                    onClick={() => {
                      setActiveMenu(menu);
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
        <Toolbar>
          <Stack spacing={1}>
            <Grid container rowSpacing={1}>
              <Grid item xs={12} sm={6}>
                <Button
                  sx={{ display: connected ? "block" : "none" }}
                  variant="contained"
                  color="primary"
                  onClick={onSaveClick}
                >
                  Save
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  sx={{ display: connected ? "block" : "none" }}
                  variant="contained"
                  color="error"
                  onClick={onEraseClick}
                >
                  Erase
                </Button>
              </Grid>
            </Grid>
            <Link
              href="https://github.com/sekigon-gonnoc/via-custom-ui-for-vial"
              target="_blank"
            >
              Usage
            </Link>
          </Stack>
        </Toolbar>
      </Grid>
      <Grid item xs={8}>
        {activeMenu === undefined ? (
          <></>
        ) : (
          <ViaMenuItem
            {...activeMenu}
            customValues={customValues}
            onChange={async (id, value) => {
              setCustomValues({ ...customValues, [id[0]]: value });
              await via.SetCustomValue(id.slice(1) as number[], value);
            }}
          ></ViaMenuItem>
        )}
      </Grid>
      <Grid item xs={1}></Grid>
    </Grid>
  );
}

export default App;
