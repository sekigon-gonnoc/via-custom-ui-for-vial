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

  async open(deviceIndex: number, onConnect: () => void | null, param: object): Promise<void> {
    if (deviceIndex >= 0) {
      try {
        await invoke("hid_open_device", { deviceIndex: deviceIndex });
      } catch (e) {
        console.log(e);
        throw e
      }
    }else {
        throw "unknown index";
    }
  }

  async close(): Promise<void> {
      
  }

  async setReceiveCallback(recvHandler: ((msg: Uint8Array) => void) | null): void {
      
  }

  async setCloseCallback(handler: () => void | null): void {
      
  }
}

export { WebRawHID };
