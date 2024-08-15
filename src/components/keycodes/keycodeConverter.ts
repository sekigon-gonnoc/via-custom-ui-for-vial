import { match, P } from 'ts-pattern'
import keycodes_0_0_3 from './0.0.3/keycodes.json'
import quantum_keycode_range_0_0_3 from './0.0.3/quantum_keycode_range.json'

const keycodes: {
  [val: string]: { group: string; key: string; label?: string; aliases?: string[] }
} = keycodes_0_0_3
const keycode_range: { [range: string]: { start: number; end: number } } =
  quantum_keycode_range_0_0_3

export type QmkKeycode = {
  value: number
  group?: string
  key: string
  label: string
  aliases?: string[]
  hold?: number
  tap?: number
  modLabel?: string
  holdLabel?: string
}

export enum ModifierBit {
  Ctrl = 1 << 0,
  Shift = 1 << 1,
  Alt = 1 << 2,
  GUI = 1 << 3,
  UseRight = 1 << 4,
}

export type ModifierBits = number

export const DefaultQmkKeycode: QmkKeycode = {
  value: 0,
  key: 'KC_NO',
  label: '',
}

const ModTapKeycodeBase: QmkKeycode = {
  label: 'ModTap',
  value: keycode_range.QK_MOD_TAP.start,
  key: 'MOD_TAP(kc)',
}

function modString(mod: number) {
  const MOD = ['C', 'S', 'A', 'G']
  const activeMod = []
  for (let b = 0; b < 4; b++) {
    if (mod & (1 << b)) {
      activeMod.push(MOD[b])
    }
  }

  return mod & 0x10 ? `${activeMod.join('+')}*` : `*${activeMod.join('+')}`
}

function convertIntToKeycode(
  value: number,
  customKeycodes?: { name: string; title: string; shortName: string }[],
): QmkKeycode {
  if (
    customKeycodes &&
    value >= keycode_range.QK_KB.start &&
    value - keycode_range.QK_KB.start < customKeycodes.length
  ) {
    const customKey = customKeycodes[value - keycode_range.QK_KB.start]
    return { value: value, key: customKey.name, label: customKey.shortName }
  } else if (Object.keys(keycodes).includes(value.toString())) {
    const keycode = keycodes[value.toString()];
    return { ...keycode, value: value, label: keycode.label ?? keycode.aliases?.[0] ?? keycode.key }
  } else {
    return match(value)
      .with(P.number.between(keycode_range.QK_MODS.start, keycode_range.QK_MODS.end), (val) => {
        return {
          value: val,
          key: 'mods',
          modLabel: modString((val >> 8) & 0x1f),
          label: convertIntToKeycode(val & 0xff).label,
        }
      })
      .with(
        P.number.between(keycode_range.QK_MOD_TAP.start, keycode_range.QK_MOD_TAP.end),
        (val) => {
          return {
            value: val,
            key: 'modTap',
            holdLabel: modString((val >> 8) & 0x1f),
            tap: val & 0xff,
            label: convertIntToKeycode(val & 0xff).label,
          }
        },
      )
      .with(
        P.number.between(keycode_range.QK_LAYER_TAP.start, keycode_range.QK_LAYER_TAP.end),
        (val) => {
          return {
            value: val,
            key: 'layerTap',
            hold: val >> 8,
            holdLabel: `Layer${(val >> 8) & 0xf}`,
            tap: val & 0xff,
            label: convertIntToKeycode(val & 0xff).label,
          }
        },
      )
      .with(P._, () => {
        return {
          group: 'unknown',
          key: `Any(${value.toString()})`,
          label: `Any(${value.toString()})`,
          value: value,
        }
      })
      .exhaustive()
  }
}

export class KeycodeConverter {
  private customKeycodes
  private layer: number
  private tapKeycodeList: QmkKeycode[] = []
  private holdKeycodeList: QmkKeycode[] = []
  constructor(
    layer: number = 16,
    customKeycodes?: { name: string; title: string; shortName: string }[],
  ) {
    this.customKeycodes = customKeycodes
    this.layer = layer

    this.tapKeycodeList = Object.entries(keycodes).map((k) => {
      const value = parseInt(k[0])
      if (
        this.customKeycodes &&
        value >= keycode_range.QK_KB.start &&
        value - keycode_range.QK_KB.start < this.customKeycodes.length
      ) {
        const customKey = this.customKeycodes[value - keycode_range.QK_KB.start]
        return { group: 'custom', value: value, key: customKey.name, label: customKey.shortName }
      } else {
        return {
          value: parseInt(k[0]),
          ...k[1],
          label: k[1].label ?? k[1].aliases?.[0] ?? k[1].key,
        }
      }
    })

    this.holdKeycodeList.push(DefaultQmkKeycode, ModTapKeycodeBase)
    this.holdKeycodeList.push(
      ...[...Array(this.layer)].map((_, layer) => {
        return {
          label: `Layer Tap ${layer}`,
          value: keycode_range.QK_LAYER_TAP.start + (layer << 8),
          key: `LT(${layer}, kc)`,
        }
      }),
    )
  }

  public getTapKeycodeList(): QmkKeycode[] {
    return this.tapKeycodeList
  }

  public getHoldKeycodeList(): QmkKeycode[] {
    return this.holdKeycodeList
  }

  public getTapKeycode(keycode?: QmkKeycode): QmkKeycode {
    if (keycode === undefined) {
      return DefaultQmkKeycode
    } else if (
      keycode_range.QK_MODS.start <= keycode.value &&
      keycode.value <= keycode_range.QK_LAYER_TAP.end
    ) {
      return this.convertIntToKeycode(keycode.value & 0xff)
    } else {
      return keycode
    }
  }

  public getHoldKeycode(keycode?: QmkKeycode): QmkKeycode {
    if (keycode === undefined) {
      return DefaultQmkKeycode
    } else if (
      keycode_range.QK_MOD_TAP.start <= keycode.value &&
      keycode.value <= keycode_range.QK_MOD_TAP.end
    ) {
      return ModTapKeycodeBase
    } else if (
      keycode_range.QK_LAYER_TAP.start <= keycode.value &&
      keycode.value <= keycode_range.QK_LAYER_TAP.end
    ) {
      return (
        this.getHoldKeycodeList().find(
          (value) => (value.value & 0xff00) === (keycode.value & 0xff00),
        ) ?? DefaultQmkKeycode
      )
    } else {
      return DefaultQmkKeycode
    }
  }

  public getModifier(keycode?: QmkKeycode): ModifierBits {
    if (keycode === undefined) {
      return 0
    } else if (
      keycode_range.QK_MODS.start <= keycode.value &&
      keycode.value <= keycode_range.QK_MOD_TAP.end
    ) {
      return (keycode.value >> 8) & 0x1f
    } else {
      return 0
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
      return this.convertIntToKeycode(tap.value | (mods << 8))
    } else if (
      keycode_range.QK_MOD_TAP.start <= hold.value &&
      hold.value <= keycode_range.QK_MOD_TAP.end
    ) {
      return this.convertIntToKeycode((tap.value & 0x00ff) | (hold.value & 0xff00) | (mods << 8))
    } else if (
      keycode_range.QK_LAYER_TAP.start <= hold.value &&
      hold.value <= keycode_range.QK_LAYER_TAP.end
    ) {
      return this.convertIntToKeycode((tap.value & 0x00ff) | (hold.value & 0xff00))
    } else {
      return tap
    }
  }

  public convertIntToKeycode(value: number): QmkKeycode {
    return convertIntToKeycode(value, this.customKeycodes)
  }
}