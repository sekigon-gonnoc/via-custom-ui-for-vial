import { Box, Tab, Tabs, Tooltip } from "@mui/material";
import { useState } from "react";
import { match, P } from "ts-pattern";
import { DefaultQmkKeycode, KeycodeConverter, QmkKeycode } from "./keycodes/keycodeConverter";

const WIDTH_1U = 50;
function KeyListKey(props: { keycode: QmkKeycode; onClick?: () => void; draggable: boolean }) {
  const [isDragging, setIsDragging] = useState(false);
  const [showToolTip, setShowToolTip] = useState(false);
  return (
    <Tooltip
      open={showToolTip}
      onOpen={() => {
        setShowToolTip(true);
      }}
      onClose={() => {
        setShowToolTip(false);
      }}
      title={`${props.keycode.key}(${props.keycode.value.toString()})`}
      placement="top"
    >
      <div
        className="keycatalog-key"
        style={{
          width: WIDTH_1U - 3,
          height: WIDTH_1U - 3,
        }}
        draggable={props.draggable}
        onDragStart={(event) => {
          if (props.draggable) {
            event.dataTransfer.setData("QmkKeycode", JSON.stringify(props.keycode));
            setIsDragging(true);
          }
        }}
        onDragEnd={(_event) => {
          if (props.draggable) {
            setIsDragging(false);
          }
        }}
        onMouseMove={(event) => {
          if (!isDragging) return;
          const { clientX, clientY } = event;
          const scrollArea = 50;
          const scrollSpeed = 10;

          if (clientX < scrollArea) {
            window.scrollBy(-scrollSpeed, 0);
          } else if (window.innerWidth - clientX < scrollArea) {
            window.scrollBy(scrollSpeed, 0);
          }

          if (clientY < scrollArea) {
            window.scrollBy(0, -scrollSpeed);
          } else if (window.innerHeight - clientY < scrollArea) {
            window.scrollBy(0, scrollSpeed);
          }
        }}
        onMouseLeave={(_event) => {
          setShowToolTip(false);
        }}
        onClick={() => {
          if (props.onClick) {
            setShowToolTip(false);
            props.onClick?.();
          }
        }}
      >
        <div>{props.keycode.shiftedLabel ?? ""}</div>
        <div>{props.keycode.label}</div>
      </div>
    </Tooltip>
  );
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3, pt: 0 }}>{children}</Box>}
    </div>
  );
}

export function KeycodeCatalog(props: {
  keycodeConverter: KeycodeConverter;
  tab: { label: string; keygroup: string[] }[];
  comboCount?: number;
  overrideCount?: number;
  onMacroSelect?: (index: number) => void;
  onTapdanceSelect?: (index: number) => void;
  onComoboSelect?: (index: number) => void;
  onOverrideSelect?: (index: number) => void;
}) {
  const [tabValue, setTabValue] = useState(0);
  return (
    <>
      <Box>
        <Tabs
          value={tabValue}
          onChange={(_event, newValue: number) => {
            setTabValue(newValue);
            console.log("tab");
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {props.tab.map((tab) => (
            <Tab key={tab.label} label={tab.label}></Tab>
          ))}
        </Tabs>
      </Box>
      {props.tab.map((tab, index) => (
        <CustomTabPanel key={index} value={tabValue} index={index}>
          {tab.keygroup.map((keygroup) => (
            <Box key={keygroup}>
              {props.keycodeConverter.getTapKeycodeList().some((k) => k.group === keygroup) ? (
                <>
                  <Box sx={{ mt: 1 }}>{keygroup}</Box>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: `repeat(auto-fit, ${WIDTH_1U}px)`,
                      gap: "8px 5px",
                    }}
                  >
                    {props.keycodeConverter
                      .getTapKeycodeList()
                      .filter((k) => k.group === keygroup)
                      .map((keycode) => {
                        return match(keycode.group)
                          .with("tapdance", () => (
                            <KeyListKey
                              key={keycode.value}
                              keycode={{ ...keycode, label: keycode.label + " 🖊" }}
                              draggable={true}
                              onClick={() => {
                                props.onTapdanceSelect?.(keycode.value & 0x1f);
                              }}
                            ></KeyListKey>
                          ))
                          .with("macro", () => (
                            <KeyListKey
                              key={keycode.value}
                              keycode={{ ...keycode, label: keycode.label + " 🖊" }}
                              draggable={true}
                              onClick={() => {
                                props.onMacroSelect?.(keycode.value & 0x1f);
                              }}
                            ></KeyListKey>
                          ))
                          .with(P._, () => (
                            <KeyListKey
                              key={keycode.value}
                              keycode={keycode}
                              draggable={true}
                            ></KeyListKey>
                          ))
                          .exhaustive();
                      })}
                  </Box>
                </>
              ) : keygroup === "combo" ? (
                <>
                  <Box sx={{ mt: 1 }}>{keygroup}</Box>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: `repeat(auto-fit, ${WIDTH_1U}px)`,
                      gap: "8px 5px",
                    }}
                  >
                    {[...Array(props.comboCount)].map((_, idx) => (
                      <KeyListKey
                        key={`combo-${idx}`}
                        keycode={{
                          ...DefaultQmkKeycode,
                          label: `Combo ${idx} 🖊`,
                          key: `Edit Combo`,
                          value: idx,
                        }}
                        draggable={false}
                        onClick={() => {
                          props.onComoboSelect?.(idx);
                        }}
                      ></KeyListKey>
                    ))}
                  </Box>
                </>
              ) : keygroup === "keyoverride" ? (
                <>
                  <Box sx={{ mt: 1 }}>{keygroup}</Box>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: `repeat(auto-fit, ${WIDTH_1U}px)`,
                      gap: "8px 5px",
                    }}
                  >
                    {[...Array(props.overrideCount)].map((_, idx) => (
                      <KeyListKey
                        key={`override-${idx}`}
                        keycode={{
                          ...DefaultQmkKeycode,
                          label: `Override ${idx} 🖊`,
                          key: `Edit override`,
                          value: idx,
                        }}
                        draggable={false}
                        onClick={() => {
                          props.onOverrideSelect?.(idx);
                        }}
                      ></KeyListKey>
                    ))}
                  </Box>
                </>
              ) : (
                <></>
              )}
            </Box>
          ))}
        </CustomTabPanel>
      ))}
    </>
  );
}
