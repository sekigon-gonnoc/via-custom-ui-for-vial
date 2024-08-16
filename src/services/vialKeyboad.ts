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
  id_eeprom_reset = 0x0a,
  id_bootloader_jump = 0x0b,
  id_dynamic_keymap_macro_get_count = 0x0c,
  id_dynamic_keymap_macro_get_buffer_size = 0x0d,
  id_dynamic_keymap_macro_get_buffer = 0x0e,
  id_dynamic_keymap_macro_set_buffer = 0x0f,
  id_dynamic_keymap_macro_reset = 0x10,
  id_dynamic_keymap_get_layer_count = 0x11,
  id_dynamic_keymap_get_buffer = 0x12,
  id_dynamic_keymap_set_buffer = 0x13,
  id_dynamic_keymap_get_encoder = 0x14,
  id_dynamic_keymap_set_encoder = 0x15,
  id_vial = 0xfe,
  id_unhandled = 0xff,
}

enum via_keyboard_value_id {
  id_uptime = 0x01,
  id_layout_options = 0x02,
  id_switch_matrix_state = 0x03,
  id_firmware_version = 0x04,
  id_device_indication = 0x05,
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
  vial_qmk_settings_get = 0x0a,
  vial_qmk_settings_set = 0x0b,
  vial_qmk_settings_reset = 0x0c,
  vial_dynamic_entry_op = 0x0d,
}

enum dynamic_vial_id {
  dynamic_vial_get_number_of_entries = 0x00,
  dynamic_vial_tap_dance_get = 0x01,
  dynamic_vial_tap_dance_set = 0x02,
  dynamic_vial_combo_get = 0x03,
  dynamic_vial_combo_set = 0x04,
  dynamic_vial_key_override_get = 0x05,
  dynamic_vial_key_override_set = 0x06,
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

  async Open(openCallback: () => void = () => {}, closeCallback: () => void = () => {}) {
    if (!this.hid.connected) {
      await this.hid.open(openCallback, [{ usagePage: 0xff60, usage: 0x61 }]);
      this.hid.setReceiveCallback(this.receiveCallback.bind(this));
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
    return navigator.locks.request("vial-keyboard", async () => {
      if (!this.hid.connected) await this.Open();
      const send = Uint8Array.from(msg);
      try {
        await this.hid.write(Uint8Array.from(send));
      } catch (error) {
        await this.hid.close();
        throw error;
      }
      const res = await this.readResponse(500);
      console.log(`received: ${res}`);

      return res;
    });
  }

  async GetProtocolVersion() {
    const res = await this.Command([via_command_id.id_get_protocol_version]);
    return res ? res[2] | (res[3] << 8) : 0;
  }

  async GetLayoutOption() {
    const res = await this.Command([
      via_command_id.id_get_keyboard_value,
      via_keyboard_value_id.id_layout_options,
    ]);
    return res ? res[5] | (res[4] << 8) | (res[3] << 16) | (res[2] << 24) : 0;
  }

  async GetVialKeyboardId() {
    const res = await this.Command([via_command_id.id_vial, vial_command_id.vial_get_keyboard_id]);
    return res?.slice(0, 4);
  }

  async GetVialCompressedDefinition(): Promise<Uint8Array> {
    const res_size = await this.Command([via_command_id.id_vial, vial_command_id.vial_get_size]);
    const size = res_size[0] + (res_size[1] << 8) + (res_size[2] << 16) + (res_size[3] << 24);

    const page_len = Math.floor((size + VIAL_PAGE_SIZE - 1) / VIAL_PAGE_SIZE);
    const vial_def: number[][] = [];

    await navigator.locks.request("vial-keyboard", async () => {
      this.hid.setReceiveCallback((res) => {
        console.log(res);
        vial_def.push(Array.from(res));
      });

      for (let page = 0; page < page_len; page++) {
        await this.hid.write(
          Uint8Array.from([via_command_id.id_vial, vial_command_id.vial_get_def, page]),
        );
      }

      const timeout_max = 3000;
      let timeout = timeout_max;
      let current_len = vial_def.length;
      while (vial_def.length < page_len) {
        await this.sleep(50);
        if (current_len != vial_def.length) {
          current_len = vial_def.length;
          timeout = timeout_max;
        } else {
          timeout -= 50;
          if (timeout < 0) {
            break;
          }
        }
      }

      this.hid.setReceiveCallback(this.receiveCallback.bind(this));
    });

    return Uint8Array.from(vial_def.flat()).slice(0, size);
  }

  async GetLayerCount() {
    const res = await this.Command([via_command_id.id_dynamic_keymap_get_layer_count]);
    return res ? res[1] : 1;
  }

  async GetLayer(
    layer: number,
    matrix_definition: { row: number; col: number },
  ): Promise<number[]> {
    const matrix_len = matrix_definition.row * matrix_definition.col * 2; // 2byte per key
    const start = layer * matrix_len;

    const page_len = Math.ceil(matrix_len / 28);
    const keymap_buffer: number[][] = [];

    await navigator.locks.request("vial-keyboard", async () => {
      this.hid.setReceiveCallback((res) => {
        console.log(res);
        keymap_buffer.push(Array.from(res.slice(4)));
      });

      for (let page = 0; page < page_len; page++) {
        await this.hid.write(
          Uint8Array.from([
            via_command_id.id_dynamic_keymap_get_buffer,
            (start + page * 28) >> 8,
            (start + page * 28) & 0xff,
            28,
          ]),
        );
      }

      const timeout_max = 3000;
      let timeout = timeout_max;
      let current_len = keymap_buffer.length;
      while (keymap_buffer.length < page_len) {
        await this.sleep(50);
        if (current_len != keymap_buffer.length) {
          current_len = keymap_buffer.length;
          timeout = timeout_max;
        } else {
          timeout -= 50;
          if (timeout < 0) {
            break;
          }
        }
      }

      this.hid.setReceiveCallback(this.receiveCallback.bind(this));
    });

    console.log(keymap_buffer);

    return keymap_buffer.flat().reduce((p: number[], c, i) => {
      if (i & 1) {
        const b = p.pop();
        p.push((b! << 8) | c);
      } else {
        p.push(c);
      }
      return p;
    }, []);
  }

  async GetDynamicEntryCount() {
    const res = await this.Command([
      via_command_id.id_vial,
      vial_command_id.vial_dynamic_entry_op,
      dynamic_vial_id.dynamic_vial_get_number_of_entries,
    ]);
    return {
      tapdance: res[0],
      combo: res[1],
      override: res[2],
    };
  }

  async GetTapDance(id: number) {
    const res = await this.Command([
      via_command_id.id_vial,
      vial_command_id.vial_dynamic_entry_op,
      dynamic_vial_id.dynamic_vial_tap_dance_get,
      id & 0xff,
    ]);

    return res[0] == 0
      ? {
          onTap: res[1] | (res[2] << 8),
          onHold: res[3] | (res[4] << 8),
          onDoubleTap: res[5] | (res[6] << 8),
          onTapHold: res[7] | (res[8] << 8),
          tappingTerm: res[9] | (res[10] << 8),
        }
      : {
          onTap: 0,
          onHold: 0,
          onDoubleTap: 0,
          onTapHold: 0,
          tappingTerm: 0,
        };
  }

  async GetMacroCount() {
    const res = await this.Command([via_command_id.id_dynamic_keymap_macro_get_count]);
    return res[1];
  }

  async GetMacroBufferLen() {
    const res = await this.Command([via_command_id.id_dynamic_keymap_macro_get_buffer_size]);
    return (res[1] << 8) | res[2];
  }

  async GetMacroBuffer(offset: number, length: number): Promise<number[]> {
    const page_len = Math.ceil(length / 28);
    const macro_buffer: number[][] = [];

    await navigator.locks.request("vial-keyboard", async () => {
      this.hid.setReceiveCallback((res) => {
        console.log(res);
        macro_buffer.push(Array.from(res.slice(4)));
      });

      for (let page = 0; page < page_len; page++) {
        await this.hid.write(
          Uint8Array.from([
            via_command_id.id_dynamic_keymap_macro_get_buffer,
            (offset + page * 28) >> 8,
            (offset + page * 28) & 0xff,
            28,
          ]),
        );
      }

      const timeout_max = 3000;
      let timeout = timeout_max;
      let current_len = macro_buffer.length;
      while (macro_buffer.length < page_len) {
        await this.sleep(50);
        if (current_len != macro_buffer.length) {
          current_len = macro_buffer.length;
          timeout = timeout_max;
        } else {
          timeout -= 50;
          if (timeout < 0) {
            break;
          }
        }
      }
    });

    this.hid.setReceiveCallback(this.receiveCallback.bind(this));

    return macro_buffer.flat();
  }

  async GetCombo(id: number) {
    const res = await this.Command([
      via_command_id.id_vial,
      vial_command_id.vial_dynamic_entry_op,
      dynamic_vial_id.dynamic_vial_combo_get,
      id & 0xff,
    ]);

    return {
      key1: res[1] | (res[2] << 8),
      key2: res[3] | (res[4] << 8),
      key3: res[5] | (res[6] << 8),
      key4: res[7] | (res[8] << 8),
      output: res[9] | (res[10] << 8),
    };
  }

  async GetCustomValue(id: number[]): Promise<number> {
    const res = await this.Command([
      via_command_id.id_unhandled,
      via_command_id.id_custom_get_value,
      ...id,
    ]);
    return (
      res[2 + id.length] |
      (res[3 + id.length] << 8) |
      (res[4 + id.length] << 16) |
      (res[5 + id.length] << 24)
    );
  }

  async SetCustomValue(id: number[], value: number): Promise<void> {
    await this.Command([
      via_command_id.id_unhandled,
      via_command_id.id_custom_set_value,
      ...id,
      value & 0xff,
      (value >> 8) & 0xff,
      (value >> 16) & 0xff,
      (value >> 24) & 0xff,
    ]);
  }

  async SaveCustomValue(id: number[]): Promise<void> {
    await this.Command([via_command_id.id_unhandled, via_command_id.id_custom_save, ...id]);
  }

  async ResetEeprom(): Promise<void> {
    await this.Command([via_command_id.id_unhandled, via_command_id.id_eeprom_reset]);
  }

  GetHidName() {
    return this.hid.getName();
  }
}

export { VialKeyboard as ViaKeyboard };
