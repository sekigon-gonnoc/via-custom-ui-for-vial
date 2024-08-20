import { KeycodeConverter } from "../components/keycodes/keycodeConverter";
import { DynamicEntryCount, ViaKeyboard, VialDefinition } from "./vialKeyboad";

export type VialKeyboardConfig = {
  layers: string[][];
  encoders: string[][][];
  tapdance: TapDanceConfig[];
  combo: ComboConfig[];
  override: OverrideConfig[];
};

export type TapDanceConfig = {
  onTap: string;
  onHold: string;
  onDoubleTap: string;
  onTapHold: string;
  tappingTerm: number;
};

export type ComboConfig = {
  key1: string;
  key2: string;
  key3: string;
  key4: string;
  output: string;
};

export type OverrideConfig = {
  trigger: string;
  replacement: string;
  layers: number;
  triggerMods: number;
  negativeModMask: number;
  suppressedMods: number;
  options: number;
};

export async function VialKeyboardGetAllConfig(
  via: ViaKeyboard,
  vialJson: VialDefinition,
  dynamicEntryCount: DynamicEntryCount,
) {
  const keycodeConverter = new KeycodeConverter(
    dynamicEntryCount.layer,
    vialJson?.customKeycodes,
    dynamicEntryCount.macro,
    dynamicEntryCount.tapdance,
  );

  const encoderCount = vialJson?.layouts.keymap
    .flatMap((row) => row.flatMap((col) => col.toString()))
    .reduce(
      (acc, key) => Math.max(acc, key.endsWith("e") ? parseInt(key.split(",")[0]) + 1 : acc),
      0,
    );

  const layers: string[][] = [];
  const encoders: string[][][] = [];
  for (let layerIdx = 0; layerIdx < dynamicEntryCount.layer; layerIdx++) {
    const layerBuffer = await via.GetLayer(layerIdx, vialJson?.matrix ?? { rows: 0, cols: 0 });
    layers.push(layerBuffer.map((keycode) => keycodeConverter.convertIntToKeycode(keycode).key));
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
      return {
        onTap: td.onTap.key,
        onHold: td.onHold.key,
        onDoubleTap: td.onDoubleTap.key,
        onTapHold: td.onTapHold.key,
        tappingTerm: td.tappingTerm,
      };
    });

  const combo: ComboConfig[] = (
    await via.GetCombo([...Array(dynamicEntryCount.combo)].map((_, idx) => idx))
  )
    .map((combo) => keycodeConverter.convertCombo(combo))
    .map((combo) => {
      return {
        key1: combo.key1.key,
        key2: combo.key2.key,
        key3: combo.key3.key,
        key4: combo.key4.key,
        output: combo.output.key,
      };
    });

  const override: OverrideConfig[] = (
    await via.GetOverride([...Array(dynamicEntryCount.override)].map((_, idx) => idx))
  )
    .map((override) => keycodeConverter.convertOverride(override))
    .map((override) => {
      return {
        ...override,
        trigger: override.trigger.key,
        replacement: override.replacement.key,
      };
    });

  return { layers, encoders, tapdance, combo, override };
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

  const keycodes = config.layers.map((layer) =>
    layer.map((key) => qmkKeycodes.find((q) => key === q.key)?.value ?? 0),
  );

  const findKeycode = (keycode: string) => qmkKeycodes.find((q) => q.key === keycode)?.value ?? 0;

  for (let layerIdx = 0; layerIdx < dynamicEntryCount.layer; layerIdx++) {
    await via.SetLayer(layerIdx, keycodes[layerIdx], vialJson!.matrix);
  }

  await via.SetEncoder(
    config.encoders
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
    config.tapdance.map((td, id) => {
      return {
        id: id,
        onTap: findKeycode(td.onTap),
        onHold: findKeycode(td.onHold),
        onDoubleTap: findKeycode(td.onDoubleTap),
        onTapHold: findKeycode(td.onTapHold),
        tappingTerm: td.tappingTerm,
      };
    }),
  );

  await via.SetCombo(
    config.combo.map((c, id) => {
      return {
        id,
        key1: findKeycode(c.key1),
        key2: findKeycode(c.key2),
        key3: findKeycode(c.key3),
        key4: findKeycode(c.key4),
        output: findKeycode(c.output),
      };
    }),
  );

  await via.SetOverride(
    config.override.map((o, id) => {
      return {
        ...o,
        id,
        trigger: findKeycode(o.trigger),
        replacement: findKeycode(o.replacement),
      };
    }),
  );
}
