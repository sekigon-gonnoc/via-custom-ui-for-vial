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

  async BatchCommand(messages: number[][], timeoutMs: number = 3000): Promise<Uint8Array[]> {
    return await navigator.locks.request("vial-keyboard", async () => {
      const commandCount = messages.length;
      const res: Uint8Array[] = [];
      this.hid.setReceiveCallback((msg) => res.push(msg));

      messages.forEach(async (msg) => await this.hid.write(Uint8Array.from(msg)));

      let timeout = timeoutMs;
      let currentLen = res.length;
      while (res.length < commandCount) {
        await this.sleep(10);
        if (currentLen != res.length) {
          currentLen = res.length;
          timeout = timeoutMs;
        } else {
          timeout -= 10;
          if (timeout < 0) {
            break;
          }
        }
      }

      this.hid.setReceiveCallback(this.receiveCallback.bind(this));

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

  async SetLayoutOption(layout: number) {
    const res = await this.Command([
      via_command_id.id_set_keyboard_value,
      via_keyboard_value_id.id_layout_options,
      (layout >> 24) & 0xff,
      (layout >> 16) & 0xff,
      (layout >> 8) & 0xff,
      layout & 0xff,
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

    const pageLen = Math.ceil(size / VIAL_PAGE_SIZE);
    const vialDef = await this.BatchCommand(
      [...Array(pageLen)].map((_, idx) => [
        via_command_id.id_vial,
        vial_command_id.vial_get_def,
        idx,
      ]),
    );
    return Uint8Array.from(
      vialDef
        .map((v) => Array.from(v))
        .flat()
        .slice(0, size),
    );
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

    const pageLen = 28;
    const pageCount = Math.ceil(matrix_len / pageLen);
    const keymap_buffer = await this.BatchCommand(
      [...Array(pageCount)].map((_, idx) => [
        via_command_id.id_dynamic_keymap_get_buffer,
        (start + idx * pageLen) >> 8,
        (start + idx * pageLen) & 0xff,
        pageLen,
      ]),
    );

    return keymap_buffer
      .map((b) => Array.from(b.slice(4)))
      .flat()
      .reduce((p: number[], c, i) => {
        if (i & 1) {
          const b = p.pop();
          p.push((b! << 8) | c);
        } else {
          p.push(c);
        }
        return p;
      }, []);
  }

  async SetKeycode(layer: number, row: number, col: number, keycode: number) {
    await this.Command([
      via_command_id.id_dynamic_keymap_set_keycode,
      layer & 0xff,
      row & 0xff,
      col & 0xff,
      keycode & 0xff,
      (keycode >> 8) & 0xff,
    ]);
  }

  async GetEncoder(layer: number, count: number): Promise<number[][]> {
    const encoder: number[][] = [];
    for (let idx = 0; idx < count; idx++) {
      const res = await this.Command([
        via_command_id.id_vial,
        vial_command_id.vial_get_encoder,
        layer,
        idx,
      ]);
      encoder.push([(res[0] << 8) | res[1], (res[2] << 8) | res[3]]);
    }

    return encoder;
  }

  async SetEncoder(layer: number, encoder: number, direction: number, keycode: number) {
    await this.Command([
      via_command_id.id_vial,
      vial_command_id.vial_set_encoder,
      layer & 0xff,
      encoder & 0xff,
      direction & 0xff,
      (keycode >> 8) & 0xff,
      keycode & 0xff,
    ]);
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

  async SetTapDance(value: {
    id: number;
    onTap: number;
    onHold: number;
    onDoubleTap: number;
    onTapHold: number;
    tappingTerm: number;
  }) {
    this.Command([
      via_command_id.id_vial,
      vial_command_id.vial_dynamic_entry_op,
      dynamic_vial_id.dynamic_vial_tap_dance_set,
      value.id & 0xff,
      value.onTap & 0xff,
      (value.onTap >> 8) & 0xff,
      value.onHold & 0xff,
      (value.onHold >> 8) & 0xff,
      value.onDoubleTap & 0xff,
      (value.onDoubleTap >> 8) & 0xff,
      value.onTapHold & 0xff,
      (value.onTapHold >> 8) & 0xff,
      value.tappingTerm & 0xff,
      (value.tappingTerm >> 8) & 0xff,
    ]);
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
    const macro_buffer = await this.BatchCommand(
      [...Array(page_len)].map((_, page) => [
        via_command_id.id_dynamic_keymap_macro_get_buffer,
        (offset + page * 28) >> 8,
        (offset + page * 28) & 0xff,
        28,
      ]),
    );

    return macro_buffer.map((b) => Array.from(b.slice(4))).flat();
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

  async SetCombo(value: {
    id: number;
    key1: number;
    key2: number;
    key3: number;
    key4: number;
    output: number;
  }) {
    await this.Command([
      via_command_id.id_vial,
      vial_command_id.vial_dynamic_entry_op,
      dynamic_vial_id.dynamic_vial_combo_set,
      value.id & 0xff,
      value.key1 & 0xff,
      (value.key1 >> 8) & 0xff,
      value.key2 & 0xff,
      (value.key2 >> 8) & 0xff,
      value.key3 & 0xff,
      (value.key3 >> 8) & 0xff,
      value.key4 & 0xff,
      (value.key4 >> 8) & 0xff,
      value.output & 0xff,
      (value.output >> 8) & 0xff,
    ]);
  }

  async GetOverride(id: number) {
    const res = await this.Command([
      via_command_id.id_vial,
      vial_command_id.vial_dynamic_entry_op,
      dynamic_vial_id.dynamic_vial_key_override_get,
      id & 0xff,
    ]);

    return {
      trigger: res[1] | (res[2] << 8),
      replacement: res[3] | (res[4] << 8),
      layers: res[5] | (res[6] << 8),
      triggerMods: res[7],
      negativeModMask: res[8],
      suppressedMods: res[9],
      options: res[10],
    };
  }

  async SetOverride(value: {
    id: number;
    trigger: number;
    replacement: number;
    layers: number;
    triggerMods: number;
    negativeModMask: number;
    suppressedMods: number;
    options: number;
  }) {
    await this.Command([
      via_command_id.id_vial,
      vial_command_id.vial_dynamic_entry_op,
      dynamic_vial_id.dynamic_vial_key_override_set,
      value.id & 0xff,
      value.trigger & 0xff,
      (value.trigger >> 8) & 0xff,
      value.replacement & 0xff,
      (value.replacement >> 8) & 0xff,
      value.layers & 0xff,
      (value.layers >> 8) & 0xff,
      value.triggerMods & 0xff,
      value.negativeModMask & 0xff,
      value.suppressedMods & 0xff,
      value.options & 0xff,
    ]);
  }

  async GetQuantumSettingsValue(id: number[]): Promise<{ [id: number]: number }> {
    const values = await this.BatchCommand(
      id.map((v) => [
        via_command_id.id_vial,
        vial_command_id.vial_qmk_settings_get,
        v & 0xff,
        (v >> 8) & 0xff,
      ]),
    );

    return values.reduce((acc, res, idx) => {
      return { ...acc, [id[idx]]: res[1] | (res[2] << 8) | (res[3] << 16) | (res[4] << 24) };
    }, {});
  }

  async SetQuantumSettingsValue(value: { [id: number]: number }) {
    await this.BatchCommand(
      Object.entries(value).map((v) => [
        via_command_id.id_vial,
        vial_command_id.vial_qmk_settings_set,
        parseInt(v[0]) & 0xff,
        (parseInt(v[0]) >> 8) & 0xff,
        v[1],
      ]),
    );
  }

  async EraseQuantumSettingsValue() {
    await this.Command([via_command_id.id_vial, vial_command_id.vial_qmk_settings_reset]);
  }

  async GetCustomValue(id: number[][]): Promise<number[]> {
    const buffers = await this.BatchCommand(
      id.map((id) => [via_command_id.id_unhandled, via_command_id.id_custom_get_value, ...id]),
    );

    const customValues = buffers.map(
      (res, idx) =>
        res[2 + id[idx].length] |
        (res[3 + id[idx].length] << 8) |
        (res[4 + id[idx].length] << 16) |
        (res[5 + id[idx].length] << 24),
    );
    return customValues;
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
