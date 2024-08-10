import { WebRawHID } from "./webRawHID";

enum via_command_id {
    id_get_protocol_version = 0x01, // always 0x01
    id_get_keyboard_value = 0x02,
    id_set_keyboard_value = 0x03,
    id_dynamic_keymap_get_keycode = 0x04,
    id_dynamic_keymap_set_keycode = 0x05,
    id_dynamic_keymap_reset = 0x06,
    id_custom_set_value = 0x07,
    id_custom_get_value = 0x08,
    id_custom_save = 0x09,
    id_eeprom_reset = 0x0A,
    id_bootloader_jump = 0x0B,
    id_dynamic_keymap_macro_get_count = 0x0C,
    id_dynamic_keymap_macro_get_buffer_size = 0x0D,
    id_dynamic_keymap_macro_get_buffer = 0x0E,
    id_dynamic_keymap_macro_set_buffer = 0x0F,
    id_dynamic_keymap_macro_reset = 0x10,
    id_dynamic_keymap_get_layer_count = 0x11,
    id_dynamic_keymap_get_buffer = 0x12,
    id_dynamic_keymap_set_buffer = 0x13,
    id_dynamic_keymap_get_encoder = 0x14,
    id_dynamic_keymap_set_encoder = 0x15,
    id_vial = 0xFE,
    id_unhandled = 0xFF,
}

enum vial_command_id {
    vial_get_keyboard_id = 0x00,
    vial_get_size = 0x01,
    vial_get_def = 0x02,
    vial_get_encoder = 0x03,
    vial_set_encoder = 0x04,
    vial_get_unlock_status = 0x05,
    vial_unlock_start = 0x06,
    vial_unlock_poll = 0x07,
    vial_lock = 0x08,
    vial_qmk_settings_query = 0x09,
    vial_qmk_settings_get = 0x0A,
    vial_qmk_settings_set = 0x0B,
    vial_qmk_settings_reset = 0x0C,
    vial_dynamic_entry_op = 0x0D,  /* operate on tapdance, combos, etc */
}

const VIAL_PAGE_SIZE = 32;

class VialKeyboard {
    private hid: WebRawHID;
    private receive_flag: boolean = false;
    private received: Uint8Array = new Uint8Array();
    constructor() {
        this.hid = new WebRawHID();
    }

    private sleep(ms: number) {
        return new Promise((resolve: any) => setTimeout(resolve, ms));
    }

    private receiveCallback(msg: Uint8Array) {
        this.receive_flag = true;
        this.received = msg;
    }

    private async readResponse(timeout: number = 100): Promise<Uint8Array> {
        let cnt = 0;
        while (!this.receive_flag && cnt < timeout) {
            await this.sleep(1);
            cnt += 1;
        }

        if (this.receive_flag) {
            this.receive_flag = false;
            return Uint8Array.from(this.received);
        } else {
            throw new Error("via command timeout");
        }
    }

    async Open(
        openCallback: () => void = () => { },
        closeCallback: () => void = () => { }
    ) {
        if (!this.hid.connected) {
            await this.hid.open(openCallback,
                [{ usagePage: 0xff60, usage: 0x61 }]
            );
            this.hid.setReceiveCallback(this.receiveCallback.bind(this))
            this.hid.setCloseCallback(closeCallback);
        }
    }

    async Close() {
        await this.hid.close();
    }

    Connected() {
        return this.hid.connected;
    }

    async Command(msg: ArrayLike<number>) {
        if (!this.hid.connected) await this.Open();
        const send = Uint8Array.from(msg);
        try {
            await this.hid.write(Uint8Array.from(send));
        } catch (error) {
            await this.hid.close()
            throw error;
        }
        const res = await this.readResponse(500);
        console.log(`received: ${res}`)

        return res;
    }

    async GetProtocolVersion() {
        const res = await this.Command([via_command_id.id_get_protocol_version])
        return res ? (res[2] | (res[3] << 8)) : 0;
    }

    async GetVialKeyboardId() {
        const res = await this.Command([via_command_id.id_vial, vial_command_id.vial_get_keyboard_id]);
        return res?.slice(0, 4);
    }

    async GetVialCompressedDefinition(): Promise<Uint8Array> {
        const res_size = await this.Command([via_command_id.id_vial, vial_command_id.vial_get_size]);
        const size = res_size[0] + (res_size[1] << 8) + (res_size[2] << 16) + (res_size[3] << 24);

        let vial_def: number[] = [];
        for (let page = 0; page < (size + VIAL_PAGE_SIZE - 1) / VIAL_PAGE_SIZE; page++) {
            const res_def = await this.Command([via_command_id.id_vial, vial_command_id.vial_get_def, page]);
            vial_def = vial_def.concat(Array.from(res_def))
        }

        return Uint8Array.from(vial_def).slice(0, size);
    }

    async GetCustomValue(id: number[]): Promise<number> {
        const res = await this.Command([via_command_id.id_unhandled, via_command_id.id_custom_get_value, ...id]);
        return res[2 + id.length] | (res[3 + id.length] << 8) | (res[4 + id.length] << 16) | (res[5 + id.length] << 24)
    }

    async SetCustomValue(id: number[], value: number): Promise<void> {
        await this.Command([via_command_id.id_unhandled, via_command_id.id_custom_set_value, ...id, value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]);
    }

    async SaveCustomValue(id: number[]): Promise<void> {
        await this.Command([via_command_id.id_unhandled, via_command_id.id_custom_save, ...id]);
    }
    
    async ResetEeprom():Promise<void>{
        await this.Command([via_command_id.id_unhandled, via_command_id.id_eeprom_reset]);
    }

    GetHidName() {
        return this.hid.getName()
    }
}

export { VialKeyboard as ViaKeyboard };