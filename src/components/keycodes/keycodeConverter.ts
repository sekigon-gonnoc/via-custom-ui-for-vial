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

export const DefaultQmkKeycode: QmkKeycode = {
  value: 0,
  key: 'KC_NO',
  label: '',
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

export function convertIntToKeycode(
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

export function getTapKeycodes(): QmkKeycode[] {
  return Object.entries(keycodes).map((k) => {
    return {
      value: parseInt(k[0]),
      ...k[1],
      label: k[1].label ?? k[1].aliases?.[0] ?? k[1].key,
    }
  })
}