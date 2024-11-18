import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { WebUsbComInterface } from "../../webUsbComInterface";

class WebRawHID implements WebUsbComInterface {
  private devicePath = "";
  private _connected = false;
  private reportId = 0;
  private unlisten = ()=>{};
  private receiveCallback: ((msg: Uint8Array) => void) | null = (msg) => {};
  get connected() {
    return this._connected;
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
    if (this._connected) return;
    if (deviceIndex >= 0) {
      try {
        const device: { path: string; reportId: number } = await invoke("hid_open_device", {
          deviceIndex: deviceIndex,
        });
        onConnect();
        this.devicePath = device.path;
        this.reportId = device.reportId;
        this.unlisten = await listen("oninputreport", (event) => {
          if (event.payload.path == this.devicePath) {
            console.log(event.payload);
            if (this.reportId == 0) {
              this.receiveCallback?.(new Uint8Array(event.payload.data));
            } else {
              this.receiveCallback?.(new Uint8Array(event.payload.data.slice(1)));
            }
          }
        });
        this._connected = true;
      } catch (e) {
        console.log(e);
        throw e;
      }
    } else {
      throw `unknown index ${deviceIndex}`;
    }
  }

  async close(): Promise<void> {
    this.unlisten();
    if (this._connected) this._connected = false;
  }

  async write(msg: Uint8Array): Promise<void> {
    console.log("write");
    console.log(`${this.reportId} ${msg}`);
    await invoke("hid_write", {
      device: this.devicePath,
      data: [this.reportId].concat(Array.from(msg)),
    });
  }

  async setReceiveCallback(recvHandler: ((msg: Uint8Array) => void) | null): void {
    this.receiveCallback = recvHandler;
  }

  async setCloseCallback(handler: () => void | null): void {}
}

export { WebRawHID };
