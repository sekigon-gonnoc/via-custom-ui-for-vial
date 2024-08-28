import { KeycodeConverter } from "../components/keycodes/keycodeConverter";
import { QuantumSettingsReadAll } from "./quantumSettings";
import { DynamicEntryCount, MenuItemDefiniton, MenuOptionalItemDefiniton, ViaKeyboard, VialDefinition } from "./vialKeyboad";

export type VialKeyboardConfig = {
  version: number;
  name: string;
  uid: bigint;
  layout: string[][][];
  encoder_layout: string[][][];
  via_protocol: number;
  vial_protocol: number;
  layout_options: number;
  macro: (string | number)[][][];
  tap_dance: TapDanceConfig[];
  combo: ComboConfig[];
  key_override: OverrideConfig[];
  settings: { [key: string]: number }; // quantum settings
  custom: {[key:string]:number};
};

export type TapDanceConfig = [string, string, string, string, number];

export type ComboConfig = [string, string, string, string, string];

export type OverrideConfig = {
  trigger: string;
  replacement: string;
  layers: number;
  trigger_mods: number;
  negative_mod_mask: number;
  suppressed_mods: number;
  options: number;
};

export async function VialKeyboardGetAllConfig(
  via: ViaKeyboard,
  vialJson: VialDefinition,
  dynamicEntryCount: DynamicEntryCount,
): Promise<VialKeyboardConfig> {
  const keycodeConverter = new KeycodeConverter(
    dynamicEntryCount.layer,
    vialJson?.customKeycodes,
    dynamicEntryCount.macro,
    dynamicEntryCount.tapdance,
  );

  const viaProtocol = await via.GetProtocolVersion();
  const keyboardId = await via.GetVialKeyboardId();
  const layoutOption = await via.GetLayoutOption();

  const encoderCount = vialJson?.layouts.keymap
    .flatMap((row) => row.flatMap((col) => col.toString()))
    .reduce(
      (acc, key) => Math.max(acc, key.endsWith("e") ? parseInt(key.split(",")[0]) + 1 : acc),
      0,
    );

  const layout: string[][][] = [];
  const encoders: string[][][] = [];
  for (let layerIdx = 0; layerIdx < dynamicEntryCount.layer; layerIdx++) {
    const layerBuffer = await via.GetLayer(layerIdx, vialJson?.matrix ?? { rows: 0, cols: 0 });
    const layerKeys = layerBuffer.map(
      (keycode) => keycodeConverter.convertIntToKeycode(keycode).key,
    );
    const rows = [...Array(vialJson?.matrix.rows)].map((_, idx) =>
      layerKeys.slice(vialJson.matrix.cols * idx, vialJson.matrix.cols * (idx + 1)),
    );
    layout.push(rows);

    if (encoderCount) {
      const encoderBuffer = await via.GetEncoder(layerIdx, encoderCount);
      encoders.push(
        encoderBuffer.map((encoder) =>
          encoder.map((k) => keycodeConverter.convertIntToKeycode(k).key),
        ),
      );
    }
  }

  const tapdance: TapDanceConfig[] = (
    await via.GetTapDance([...Array(dynamicEntryCount.tapdance)].map((_, idx) => idx))
  )
    .map((td) => keycodeConverter.convertTapDance(td))
    .map((td) => {
      return [td.onTap.key, td.onHold.key, td.onDoubleTap.key, td.onTapHold.key, td.tappingTerm];
    });

  const combo: ComboConfig[] = (
    await via.GetCombo([...Array(dynamicEntryCount.combo)].map((_, idx) => idx))
  )
    .map((combo) => keycodeConverter.convertCombo(combo))
    .map((combo) => {
      return [combo.key1.key, combo.key2.key, combo.key3.key, combo.key4.key, combo.output.key];
    });

  const override: OverrideConfig[] = (
    await via.GetOverride([...Array(dynamicEntryCount.override)].map((_, idx) => idx))
  )
    .map((override) => keycodeConverter.convertOverride(override))
    .map((override) => {
      return {
        trigger: override.trigger.key,
        replacement: override.replacement.key,
        layers: override.layers,
        trigger_mods: override.triggerMods,
        negative_mod_mask: override.negativeModMask,
        suppressed_mods: override.suppressedMods,
        options: override.options,
      };
    });

  const quantum = await QuantumSettingsReadAll(via);

  const macro = (await via.GetMacros(dynamicEntryCount.macro)).map((buffer) => {
    const newActions: (number | string)[][] = [];
    let idx = 0;
    while (idx < buffer.length) {
      if (buffer[idx] == 1) {
        idx += 1;
        if (1 <= buffer[idx] && buffer[idx] <= 3) {
          const keycode = buffer[idx + 1];
          newActions.push([]);
          newActions[newActions.length - 1].push(
            ["tap", "down", "up"][buffer[idx] - 1],
            keycodeConverter.convertIntToKeycode(keycode).key,
          );
          idx += 2;
        } else if (buffer[idx] == 4) {
          const delay = buffer[idx + 1] - 1 + (buffer[idx + 2] - 1) * 255;
          newActions.push([]);
          newActions[newActions.length - 1].push("delay", delay);
          idx += 3;
        } else if (5 <= buffer[idx] && buffer[idx] <= 7) {
          const keycode = buffer[idx + 1] | (buffer[idx + 2] << 8);
          newActions.push([]);
          newActions[newActions.length - 1].push(
            ["tap", "down", "up"][buffer[idx] - 5],
            keycodeConverter.convertIntToKeycode(keycode).key,
          );
          idx += 3;
        }
      } else {
        if ((newActions[newActions.length - 1]?.length ?? 0) === 0) {
          newActions.push([]);
          newActions[newActions.length - 1].push("text");
          newActions[newActions.length - 1].push("");
        }
        newActions[newActions.length - 1][1] += new TextDecoder().decode(
          Uint8Array.from([buffer[idx]]),
        );

        idx += 1;
      }
    }
    return newActions;
  });

    const customValueId = vialJson.menus?.flatMap((top) =>
      top.content.reduce((prev: (string | number)[][], section) => {
        if (Object.keys(section).includes("type")) {
          prev.push((section as MenuItemDefiniton).content);
        } else {
          for (const c of section.content) {
            if (typeof c === "string") {
              prev.push(section.content as (string | number)[]);
              break;
            } else if (Object.keys(c).includes("showIf")) {
              prev.push(...(c as MenuOptionalItemDefiniton).content.map((c) => c.content));
            } else if (Object.keys(c).includes("type")) {
              prev.push((c as MenuItemDefiniton).content);
            }
          }
        }
        return prev;
      }, []),
    );

    const buffer = await via.GetCustomValue(customValueId?.map((v) => v.slice(1) as number[]) ?? []);
    const customValues: { [id: string]: number } = buffer.reduce((acc, value, idx) => {
      return { ...acc, [customValueId[idx][0]]: value };
    }, {});

  return {
    version: 1,
    name: vialJson.name,
    uid: keyboardId.uid,
    via_protocol: viaProtocol,
    vial_protocol: keyboardId.vialProtocol,
    layout_options: layoutOption,
    layout,
    macro: macro,
    encoder_layout: encoders,
    tap_dance: tapdance,
    combo,
    key_override: override,
    settings: quantum,
    custom: customValues,
  };
}

export async function VialKeyboardSetAllConfig(
  via: ViaKeyboard,
  config: VialKeyboardConfig,
  vialJson: VialDefinition,
  dynamicEntryCount: DynamicEntryCount,
) {
  const keycodeConverter = new KeycodeConverter(
    dynamicEntryCount.layer,
    vialJson?.customKeycodes,
    dynamicEntryCount.macro,
    dynamicEntryCount.tapdance,
  );

  const qmkKeycodes = [...Array(0xffff)].map((_, idx) => keycodeConverter.convertIntToKeycode(idx));

  const keycodes = config.layout.map((layer) =>
    layer.flat().map((key) => qmkKeycodes.find((q) => key === q.key)?.value ?? 0),
  );

  const findKeycode = (keycode: string): number => {
    for (let idx = 0; idx < qmkKeycodes.length; idx++) {
      if (qmkKeycodes[idx].key === keycode) {
        return qmkKeycodes[idx].value;
      }
    }
    return 0;
  };


  for (let layerIdx = 0; layerIdx < dynamicEntryCount.layer; layerIdx++) {
    await via.SetLayer(layerIdx, keycodes[layerIdx], vialJson!.matrix);
  }

  await via.SetEncoder(
    config.encoder_layout
      .map((layer) => layer.map((encoder) => encoder.map((key) => findKeycode(key))))
      .flatMap((layer, layerIdx) =>
        layer.flatMap((encoder, encoderIdx) => {
          return [
            { layer: layerIdx, index: encoderIdx, direction: 0, keycode: encoder[0] },
            { layer: layerIdx, index: encoderIdx, direction: 1, keycode: encoder[1] },
          ];
        }),
      ),
  );

  await via.SetTapDance(
    config.tap_dance.map((td, id) => {
      return {
        id: id,
        onTap: findKeycode(td[0]),
        onHold: findKeycode(td[1]),
        onDoubleTap: findKeycode(td[2]),
        onTapHold: findKeycode(td[3]),
        tappingTerm: td[4],
      };
    }),
  );

  await via.SetCombo(
    config.combo.map((c, id) => {
      return {
        id,
        key1: findKeycode(c[0]),
        key2: findKeycode(c[1]),
        key3: findKeycode(c[2]),
        key4: findKeycode(c[3]),
        output: findKeycode(c[4]),
      };
    }),
  );

  await via.SetOverride(
    config.key_override.map((o, id) => {
      return {
        id,
        trigger: findKeycode(o.trigger),
        replacement: findKeycode(o.replacement),
        layers: o.layers,
        triggerMods: o.trigger_mods,
        negativeModMask: o.negative_mod_mask,
        suppressedMods: o.suppressed_mods,
        options: o.options,
      };
    }),
  );

  await via.SetMacroBuffer(
    0,
    config.macro
      .map((macro) => {
        const actions = macro
          .map((action) => {
            const [key, value] = action as [string, string | number];
            if (key === "tap") {
              const keycode = findKeycode(value as string);
              return keycode > 0xff ? [1, 5, keycode & 0xff, keycode >> 8] : [1,1, keycode];
            } else if (key === "down") {
              const keycode = findKeycode(value as string);
              return keycode > 0xff ? [1, 6, keycode & 0xff, keycode >> 8] : [1,2, keycode];
            } else if (key === "up") {
              const keycode = findKeycode(value as string);
              return keycode > 0xff ? [1, 7, keycode & 0xff, keycode >> 8] : [1, 3, keycode];
            } else if (key === "delay") {
              const delay: number = value as number;
              const upperbyte = Math.floor(delay / 255) + 1;
              return [1, 4, delay - (upperbyte - 1) * 255 + 1, upperbyte];
            } else if (key === "text") {
              return Array.from(new TextEncoder().encode(value as string));
            } else {
              return [];
            }
          })
          .flat();
        actions.push(0);
        return actions;
      })
      .flat(),
  );

  await via.SetQuantumSettingsValue(config.settings);
}
