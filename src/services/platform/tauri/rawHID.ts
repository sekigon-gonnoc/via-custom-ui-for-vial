import { invoke } from "@tauri-apps/api/core";
import { WebUsbComInterface } from "../../webUsbComInterface";

class WebRawHID implements WebUsbComInterface {
  get connected() {
    return false;
  }

  constructor() {}

  async getDeviceList(): Promise<
    {
      name: string;
      vid: number;
      pid: number;
      opened: boolean;
      usage: number[];
      usagePage: number[];
    }[]
  > {
    const devices: {
      name: string;
      vid: number;
      pid: number;
      opened: boolean;
      usage: number[];
      usagePage: number[];
    }[] = await invoke("hid_get_devices");

    console.log(devices);

    return devices;
  }
}

export { WebRawHID };
