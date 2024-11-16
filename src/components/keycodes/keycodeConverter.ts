import { match, P } from "ts-pattern";

export type QmkKeycode = {
  value: number;
  group?: string;
  key: string;
  label: string;
  shiftedLabel?: string;
  aliases?: string[];
  hold?: number;
  tap?: number;
  modLabel?: string;
  holdLabel?: string;
};

export type TapDance = {
  onTap: QmkKeycode;
  onHold: QmkKeycode;
  onDoubleTap: QmkKeycode;
  onTapHold: QmkKeycode;
  tappingTerm: number;
};

export type Combo = {
  key1: QmkKeycode;
  key2: QmkKeycode;
  key3: QmkKeycode;
  key4: QmkKeycode;
  output: QmkKeycode;
};

export type Override = {
  trigger: QmkKeycode;
  replacement: QmkKeycode;
  layers: number;
  triggerMods: number;
  negativeModMask: number;
  suppressedMods: number;
  options: number;
};

export enum ModifierBit {
  Ctrl = 1 << 0,
  Shift = 1 << 1,
  Alt = 1 << 2,
  GUI = 1 << 3,
  UseRight = 1 << 4,
}

export type ModifierBits = number;

export const DefaultQmkKeycode: QmkKeycode = {
  value: 0,
  key: "KC_NO",
  label: "",
};

function modStringShort(mod: number) {
  const MOD = ["C", "S", "A", "G"];
  const activeMod = [];
  for (let b = 0; b < 4; b++) {
    if (mod & (1 << b)) {
      activeMod.push(MOD[b]);
    }
  }

  return mod & 0x10 ? `${activeMod.join("+")}*` : `*${activeMod.join("+")}`;
}

function modStringLong(mod: number) {
  const MOD = ["CTL", "SFT", "ALT", "GUI"];
  const activeMod = [];
  for (let b = 0; b < 4; b++) {
    if (mod & (1 << b)) {
      activeMod.push(MOD[b]);
    }
  }

  return mod & 0x10
    ? `${activeMod.map((m) => `MOD_R${m}`).join("|")}`
    : `${activeMod.map((m) => `MOD_L${m}`).join("|")}`;
}

type KeycodeDefinition = {
  [val: string]: {
    group: string;
    key: string;
    label?: string;
    shiftedLabel?: string;
    aliases?: string[];
    language?: { [lang: string]: { label: string; shiftedLabel?: string } };
  };
};

type KeycodeRangeDefinition = { [range: string]: { start: number; end: number } };

export class KeycodeConverter {
  private customKeycodes;
  private layer: number;
  private tapKeycodeList: QmkKeycode[] = [];
  private tapKeycodeMap: QmkKeycode[] = [];
  private holdKeycodeList: QmkKeycode[] = [];
  private modTapKeycodeBase: QmkKeycode;
  private keycode_range: KeycodeRangeDefinition;

  static async Create(
    layer: number = 16,
    customKeycodes?: { name: string; title: string; shortName: string }[],
    macroCount: number = 0,
    tapDanceCount: number = 0,
    language: string = "US",
    version: string = "0.0.3",
  ) {
    const keycodes: KeycodeDefinition = {
      ...(await (await fetch(`keycodes/${version}/keycodes.json`)).json()),
      ...(await (await fetch(`keycodes/${version}/keycode_override.json`)).json()),
    };
    const keycode_range: KeycodeRangeDefinition = await (
      await fetch(`keycodes/${version}/quantum_keycode_range.json`)
    ).json();

    return new KeycodeConverter(
      keycodes,
      keycode_range,
      layer,
      customKeycodes,
      macroCount,
      tapDanceCount,
      language,
    );
  }

  private constructor(
    keycodes: KeycodeDefinition,
    keycode_range: KeycodeRangeDefinition,
    layer: number = 16,
    customKeycodes?: { name: string; title: string; shortName: string }[],
    macroCount: number = 0,
    tapDanceCount: number = 0,
    language: string = "US",
  ) {
    this.customKeycodes = customKeycodes;
    this.layer = layer;
    this.keycode_range = keycode_range;

    this.tapKeycodeList = Object.entries(keycodes)
      .filter(
        (k) => k[1].group !== "macro" || parseInt(k[0]) - keycode_range.QK_MACRO.start < macroCount,
      )
      .map((k) => {
        const value = parseInt(k[0]);
        if (
          this.customKeycodes &&
          value >= keycode_range.QK_KB.start &&
          value - keycode_range.QK_KB.start < this.customKeycodes.length
        ) {
          const customKey = this.customKeycodes[value - keycode_range.QK_KB.start];
          return { group: "custom", value: value, key: customKey.name, label: customKey.shortName };
        } else {
          let langLabel: string | undefined = undefined;
          let shiftedLabel: string | undefined = k[1].shiftedLabel;
          if (k[1].language && k[1].language[language.toLocaleLowerCase()]) {
            langLabel = k[1].language[language.toLocaleLowerCase()].label;
            shiftedLabel = k[1].language[language.toLocaleLowerCase()].shiftedLabel;
          }

          return {
            value: parseInt(k[0]),
            ...k[1],
            shiftedLabel: shiftedLabel,
            label: langLabel ?? k[1].label ?? k[1].aliases?.[0] ?? k[1].key,
          };
        }
      });

    if (tapDanceCount > 0) {
      this.tapKeycodeList.push(
        ...[...Array(tapDanceCount)].map((_, idx) => {
          return {
            group: "tapdance",
            value: keycode_range.QK_TAP_DANCE.start + idx,
            key: `TAP_DANCE_${idx}`,
            label: `TD${idx}`,
          };
        }),
      );
    }

    if (layer > 0) {
      this.tapKeycodeList.push(
        ...[...Array(layer)].map((_, idx) => {
          return {
            group: "layer",
            value: keycode_range.QK_TO.start + idx,
            key: `To Layer ${idx}`,
            label: `TO${idx}`,
          };
        }),
      );
      this.tapKeycodeList.push(
        ...[...Array(layer)].map((_, idx) => {
          return {
            group: "layer",
            value: keycode_range.QK_MOMENTARY.start + idx,
            key: `Momentary Layer ${idx}`,
            label: `MO${idx}`,
          };
        }),
      );
      this.tapKeycodeList.push(
        ...[...Array(layer)].map((_, idx) => {
          return {
            group: "layer",
            value: keycode_range.QK_DEF_LAYER.start + idx,
            key: `Default Layer ${idx}`,
            label: `DF${idx}`,
          };
        }),
      );
      this.tapKeycodeList.push(
        ...[...Array(layer)].map((_, idx) => {
          return {
            group: "layer",
            value: keycode_range.QK_TOGGLE_LAYER.start + idx,
            key: `Toggle Layer ${idx}`,
            label: `TG${idx}`,
          };
        }),
      );
      this.tapKeycodeList.push(
        ...[...Array(layer)].map((_, idx) => {
          return {
            group: "layer",
            value: keycode_range.QK_ONE_SHOT_LAYER.start + idx,
            key: `Oneshot Layer ${idx}`,
            label: `OSL${idx}`,
          };
        }),
      );
    }
    this.tapKeycodeList.push(
      ...[...Array(Math.min(this.layer, 16))].map((_, layer) => {
        return {
          group: "layer",
          value: keycode_range.QK_LAYER_MOD.start + (layer << 5),
          key: `Layer Mod(${layer}, mod)`,
          label: `LM${layer}`,
        };
      }),
    );

    this.tapKeycodeList = this.tapKeycodeList.map((k) => {
      return { ...k, label: k.label.length > 2 ? k.label.replace(/_/g, " ") : k.label };
    });
    this.tapKeycodeMap = Array(0xffff);
    for (const k of this.tapKeycodeList) {
      this.tapKeycodeMap[k.value] = k;
    }

    this.modTapKeycodeBase = {
      label: " Mod Tap",
      value: keycode_range.QK_MOD_TAP.start,
      key: "MOD_TAP(kc)",
    };

    this.holdKeycodeList.push(DefaultQmkKeycode, this.modTapKeycodeBase);
    this.holdKeycodeList.push(
      ...[...Array(Math.min(this.layer, 16))].map((_, layer) => {
        return {
          label: `Layer Tap ${layer}`,
          value: keycode_range.QK_LAYER_TAP.start + (layer << 8),
          key: `LT(${layer}, kc)`,
        };
      }),
    );
  }

  public getTapKeycodeList(): QmkKeycode[] {
    return this.tapKeycodeList;
  }

  public getHoldKeycodeList(): QmkKeycode[] {
    return this.holdKeycodeList;
  }

  public getTapKeycode(keycode?: QmkKeycode): QmkKeycode {
    if (keycode === undefined) {
      return DefaultQmkKeycode;
    } else if (
      this.keycode_range.QK_MODS.start <= keycode.value &&
      keycode.value <= this.keycode_range.QK_LAYER_TAP.end
    ) {
      return this.convertIntToKeycode(keycode.value & 0xff);
    } else if (
      this.keycode_range.QK_LAYER_MOD.start <= keycode.value &&
      keycode.value <= this.keycode_range.QK_LAYER_MOD.end
    ) {
      return this.convertIntToKeycode(keycode.value & 0xffe0);
    } else {
      return keycode;
    }
  }

  public getHoldKeycode(keycode?: QmkKeycode): QmkKeycode {
    if (keycode === undefined) {
      return DefaultQmkKeycode;
    } else if (
      this.keycode_range.QK_MOD_TAP.start <= keycode.value &&
      keycode.value <= this.keycode_range.QK_MOD_TAP.end
    ) {
      return this.modTapKeycodeBase;
    } else if (
      this.keycode_range.QK_LAYER_TAP.start <= keycode.value &&
      keycode.value <= this.keycode_range.QK_LAYER_TAP.end
    ) {
      return (
        this.getHoldKeycodeList().find(
          (value) => (value.value & 0xff00) === (keycode.value & 0xff00),
        ) ?? DefaultQmkKeycode
      );
    } else {
      return DefaultQmkKeycode;
    }
  }

  public getModifier(keycode?: QmkKeycode): ModifierBits {
    if (keycode === undefined) {
      return 0;
    } else if (
      this.keycode_range.QK_MODS.start <= keycode.value &&
      keycode.value <= this.keycode_range.QK_MOD_TAP.end
    ) {
      return (keycode.value >> 8) & 0x1f;
    } else if (
      this.keycode_range.QK_LAYER_MOD.start <= keycode.value &&
      keycode.value <= this.keycode_range.QK_LAYER_MOD.end
    ) {
      return keycode.value & 0x1f;
    } else {
      return 0;
    }
  }

  public combineKeycodes(
    tap: QmkKeycode,
    hold: QmkKeycode,
    mods: ModifierBits = 0,
  ): QmkKeycode | null {
    if (
      this.keycode_range.QK_BASIC.start <= tap.value &&
      tap.value <= this.keycode_range.QK_BASIC.end &&
      hold.value == 0
    ) {
      return this.convertIntToKeycode(tap.value | (mods << 8));
    } else if (
      this.keycode_range.QK_LAYER_MOD.start <= tap.value &&
      tap.value <= this.keycode_range.QK_LAYER_MOD.end
    ) {
      return this.convertIntToKeycode((tap.value & 0xffe0) | mods);
    } else if (tap.value > this.keycode_range.QK_BASIC.end) {
      return this.convertIntToKeycode(tap.value);
    } else if (
      this.keycode_range.QK_MOD_TAP.start <= hold.value &&
      hold.value <= this.keycode_range.QK_MOD_TAP.end
    ) {
      return this.convertIntToKeycode((tap.value & 0x00ff) | (hold.value & 0xff00) | (mods << 8));
    } else if (
      this.keycode_range.QK_LAYER_TAP.start <= hold.value &&
      hold.value <= this.keycode_range.QK_LAYER_TAP.end
    ) {
      return this.convertIntToKeycode((tap.value & 0x00ff) | (hold.value & 0xff00));
    } else {
      return tap;
    }
  }

  public convertIntToKeycode(value: number): QmkKeycode {
    if (value === undefined) {
      return DefaultQmkKeycode;
    }

    if (this.tapKeycodeMap[value] !== undefined) return this.tapKeycodeMap[value];

    return match(value)
      .with(
        P.number.between(this.keycode_range.QK_MODS.start, this.keycode_range.QK_MODS.end),
        (val) => {
          const modLabel = modStringShort((val >> 8) & 0x1f);
          const modLongLabel = modStringLong((val >> 8) & 0x1f);
          const baseKeycode = this.convertIntToKeycode(val & 0xff);
          return {
            value: val,
            key: `MODS(${modLongLabel},${baseKeycode.key})`,
            modLabel: modLabel,
            label: baseKeycode.label,
            shiftedLabel: baseKeycode.shiftedLabel,
          };
        },
      )
      .with(
        P.number.between(this.keycode_range.QK_MOD_TAP.start, this.keycode_range.QK_MOD_TAP.end),
        (val) => {
          const modLabel = modStringShort((val >> 8) & 0x1f);
          const modLongLabel = modStringLong((val >> 8) & 0x1f);
          const baseKeycode = this.convertIntToKeycode(val & 0xff);
          return {
            value: val,
            key: `MOD_TAP(${modLongLabel},${baseKeycode.key})`,
            holdLabel: modLabel,
            tap: val & 0xff,
            label: baseKeycode.label,
            shiftedLabel: baseKeycode.shiftedLabel,
          };
        },
      )
      .with(
        P.number.between(
          this.keycode_range.QK_LAYER_TAP.start,
          this.keycode_range.QK_LAYER_TAP.end,
        ),
        (val) => {
          const baseKeycode = this.convertIntToKeycode(val & 0xff);
          return {
            value: val,
            key: `LT(${(val >> 8) & 0xf},${baseKeycode.key})`,
            hold: val >> 8,
            holdLabel: `Layer${(val >> 8) & 0xf}`,
            tap: val & 0xff,
            label: baseKeycode.label,
            shiftedLabel: baseKeycode.shiftedLabel,
          };
        },
      )
      .with(
        P.number.between(
          this.keycode_range.QK_LAYER_MOD.start,
          this.keycode_range.QK_LAYER_MOD.end,
        ),
        (val) => {
          const modLabel = modStringShort(val & 0x1f);
          const modLongLabel = modStringLong(val & 0x1f);
          return {
            value: val,
            key: `LM(${(val >> 5) & 0xf}, ${modLongLabel})`,
            label: `LM(${(val >> 5) & 0xf}, ${modLabel})`,
          };
        },
      )
      .with(P.number, () => {
        return {
          group: "unknown",
          key: `Any(${value.toString()})`,
          label: `Any(${value.toString()})`,
          value: value,
        };
      })
      .exhaustive();
  }

  public convertTapDance(td: {
    onTap: number;
    onHold: number;
    onDoubleTap: number;
    onTapHold: number;
    tappingTerm: number;
  }): TapDance {
    return {
      onTap: this.convertIntToKeycode(td.onTap),
      onHold: this.convertIntToKeycode(td.onHold),
      onDoubleTap: this.convertIntToKeycode(td.onDoubleTap),
      onTapHold: this.convertIntToKeycode(td.onTapHold),
      tappingTerm: td.tappingTerm,
    };
  }

  public convertCombo(combo: {
    key1: number;
    key2: number;
    key3: number;
    key4: number;
    output: number;
  }): Combo {
    return {
      key1: this.convertIntToKeycode(combo.key1),
      key2: this.convertIntToKeycode(combo.key2),
      key3: this.convertIntToKeycode(combo.key3),
      key4: this.convertIntToKeycode(combo.key4),
      output: this.convertIntToKeycode(combo.output),
    };
  }

  public convertOverride(override: {
    trigger: number;
    replacement: number;
    layers: number;
    triggerMods: number;
    negativeModMask: number;
    suppressedMods: number;
    options: number;
  }): Override {
    return {
      ...override,
      trigger: this.convertIntToKeycode(override.trigger),
      replacement: this.convertIntToKeycode(override.replacement),
    };
  }
}
