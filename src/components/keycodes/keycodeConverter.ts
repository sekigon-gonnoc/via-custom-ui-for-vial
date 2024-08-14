
import keycodes0_0_3 from "./0.0.3/keycodes.json" ;

const keycodes: { [val: string]: { group: string, key: string, label?: string, aliases?: string[] } } = keycodes0_0_3;

export type QmkKeycode = {
    val: number,
    group: string,
    key: string,
    label?: string,
    aliases?: string[]
};

export function convertIntToKeycode(val: number): QmkKeycode {
    if (Object.keys(keycodes).includes(val.toString())) {
        return { ...keycodes[val.toString()], val: val };
    } else {
        return { group: "unknown", key: `Any(${val.toString()})`, label: `Any(${val.toString()})`, val: val };
    }
}