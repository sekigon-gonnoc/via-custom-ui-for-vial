import { Box, Grid, Tab, Tabs, Tooltip } from "@mui/material";
import { KeycodeConverter, QmkKeycode } from "./keycodes/keycodeConverter";
import { useState } from "react";

const WIDTH_1U = 50;
function KeyListKey(props: { keycode: QmkKeycode }) {
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
      <Box
        style={{
          width: WIDTH_1U - 3,
          height: WIDTH_1U - 3,
          outline: "solid",
          outlineWidth: "1px",
          outlineColor: "black",
        }}
        draggable={true}
        onDragStart={(event) => {
          event.dataTransfer.setData("QmkKeycode", JSON.stringify(props.keycode));
          setIsDragging(true);
        }}
        onDragEnd={(event) => {
          setIsDragging(false);
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
        onMouseLeave={(event) => {
          setShowToolTip(false);
        }}
      >
        {props.keycode.label}
      </Box>
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
}) {
  const [tabValue, setTabValue] = useState(0);
  return (
    <>
      <Box>
        <Tabs
          value={tabValue}
          onChange={(event, newValue: number) => {
            setTabValue(newValue);
            console.log("tab");
          }}
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
                      .map((keycode) => (
                        <KeyListKey key={keycode.value} keycode={keycode}></KeyListKey>
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
