# VIA custom UI for Vial

This application is designed to integrate [custom menus of VIA](https://www.caniusevia.com/docs/custom_ui) into Vial. By writing the definitions for VIA's custom UI in `vial.json`, various menus can be displayed.

Currently, this application supports only the `button`, `toggle`, `range`, `dropdown`, and `color` UI elements. It does not support the `keycode` UI element.

To use this with Vial firmware, implement `via_custom_value_command_kb` as per the VIA documentation. Additionally, implement `raw_hid_receive_kb` as shown below.

```c
void raw_hid_receive_kb(uint8_t *data, uint8_t length) {
    uint8_t *command_id = &(data[0]);

    // Due to an older version of via.c in Vial that does not support
    // id_custom_set/get_value, we use id_handled to invoke via_custom_value_command_kb.
    if (*command_id == id_unhandled) {
        via_custom_value_command_kb(&data[1], length - 1);
    }
}
```