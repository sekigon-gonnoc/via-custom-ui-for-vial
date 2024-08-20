import { match, P } from "ts-pattern";
import keycode_override_0_0_3 from "./0.0.3/keycode_override.json";
import keycodes_0_0_3 from "./0.0.3/keycodes.json";
import quantum_keycode_range_0_0_3 from "./0.0.3/quantum_keycode_range.json";

const keycodes: {
  [val: string]: { group: string; key: string; label?: string; aliases?: string[] };
} = { ...keycodes_0_0_3, ...keycode_override_0_0_3 };
const keycode_range: { [range: string]: { start: number; end: number } } =
  quantum_keycode_range_0_0_3;

export type QmkKeycode = {
  value: number;
  group?: string;
  key: string;
  label: string;
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

const ModTapKeycodeBase: QmkKeycode = {
  label: " Mod Tap",
  value: keycode_range.QK_MOD_TAP.start,
  key: "MOD_TAP(kc)",
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

export class KeycodeConverter {
  private customKeycodes;
  private layer: number;
  private tapKeycodeList: QmkKeycode[] = [];
  private holdKeycodeList: QmkKeycode[] = [];
  constructor(
    layer: number = 16,
    customKeycodes?: { name: string; title: string; shortName: string }[],
    macroCount: number = 0,
    tapDanceCount: number = 0,
  ) {
    this.customKeycodes = customKeycodes;
    this.layer = layer;

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
          return {
            value: parseInt(k[0]),
            ...k[1],
            label: k[1].label ?? k[1].aliases?.[0] ?? k[1].key,
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

    this.tapKeycodeList = this.tapKeycodeList.map((k) => {
      return { ...k, label: k.label.length > 2 ? k.label.replace(/_/g, " ") : k.label };
    });

    this.holdKeycodeList.push(DefaultQmkKeycode, ModTapKeycodeBase);
    this.holdKeycodeList.push(
      ...[...Array(this.layer)].map((_, layer) => {
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
      keycode_range.QK_MODS.start <= keycode.value &&
      keycode.value <= keycode_range.QK_LAYER_TAP.end
    ) {
      return this.convertIntToKeycode(keycode.value & 0xff);
    } else {
      return keycode;
    }
  }

  public getHoldKeycode(keycode?: QmkKeycode): QmkKeycode {
    if (keycode === undefined) {
      return DefaultQmkKeycode;
    } else if (
      keycode_range.QK_MOD_TAP.start <= keycode.value &&
      keycode.value <= keycode_range.QK_MOD_TAP.end
    ) {
      return ModTapKeycodeBase;
    } else if (
      keycode_range.QK_LAYER_TAP.start <= keycode.value &&
      keycode.value <= keycode_range.QK_LAYER_TAP.end
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
      keycode_range.QK_MODS.start <= keycode.value &&
      keycode.value <= keycode_range.QK_MOD_TAP.end
    ) {
      return (keycode.value >> 8) & 0x1f;
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
      keycode_range.QK_BASIC.start <= tap.value &&
      tap.value <= keycode_range.QK_BASIC.end &&
      hold.value == 0
    ) {
      return this.convertIntToKeycode(tap.value | (mods << 8));
    } else if (tap.value > keycode_range.QK_BASIC.end) {
      return this.convertIntToKeycode(tap.value);
    } else if (
      keycode_range.QK_MOD_TAP.start <= hold.value &&
      hold.value <= keycode_range.QK_MOD_TAP.end
    ) {
      return this.convertIntToKeycode((tap.value & 0x00ff) | (hold.value & 0xff00) | (mods << 8));
    } else if (
      keycode_range.QK_LAYER_TAP.start <= hold.value &&
      hold.value <= keycode_range.QK_LAYER_TAP.end
    ) {
      return this.convertIntToKeycode((tap.value & 0x00ff) | (hold.value & 0xff00));
    } else {
      return tap;
    }
  }

  public convertIntToKeycode(value: number): QmkKeycode {
    if (value === undefined) {
      return DefaultQmkKeycode;
    } else if (this.tapKeycodeList.map((k) => k.value).includes(value)) {
      return this.tapKeycodeList.find((k) => k.value === value) ?? DefaultQmkKeycode;
    } else {
      return match(value)
        .with(P.number.between(keycode_range.QK_MODS.start, keycode_range.QK_MODS.end), (val) => {
          const modLabel = modStringShort((val >> 8) & 0x1f);
          const modLongLabel = modStringLong((val >> 8) & 0x1f);
          const baseKeycode = this.convertIntToKeycode(val & 0xff);
          return {
            value: val,
            key: `MODS(${modLongLabel},${baseKeycode.key})`,
            modLabel: modLabel,
            label: baseKeycode.label,
          };
        })
        .with(
          P.number.between(keycode_range.QK_MOD_TAP.start, keycode_range.QK_MOD_TAP.end),
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
            };
          },
        )
        .with(
          P.number.between(keycode_range.QK_LAYER_TAP.start, keycode_range.QK_LAYER_TAP.end),
          (val) => {
            const baseKeycode = this.convertIntToKeycode(val & 0xff);
            return {
              value: val,
              key: `LT(${(val >> 8) & 0xf},${baseKeycode.key})`,
              hold: val >> 8,
              holdLabel: `Layer${(val >> 8) & 0xf}`,
              tap: val & 0xff,
              label: baseKeycode.label,
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
      onHold: this.convertIntToKeycode(td.onTap),
      onDoubleTap: this.convertIntToKeycode(td.onTap),
      onTapHold: this.convertIntToKeycode(td.onTap),
      tappingTerm: td.tappingTerm,
    };
  }
}
