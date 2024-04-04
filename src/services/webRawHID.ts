import { WebUsbComInterface } from "./webUsbComInterface";

class WebRawHID implements WebUsbComInterface {
  private receiveCallback: ((msg: Uint8Array) => void) | null = null;
  private closeCallback: (() => void) = () => { };

  private port: any | null = null;

  get connected() {
    return this.port?.opened ?? false;
  }

  constructor() {
    (navigator as any).hid.addEventListener("disconnect", this.closeCallback.bind(this));
  }

  setReceiveCallback(recvHandler: ((msg: Uint8Array) => void) | null) {
    this.receiveCallback = (e: any) => {
      recvHandler?.(new Uint8Array((e.data as DataView).buffer));
    };
    this.port.addEventListener("inputreport", this.receiveCallback);
    console.log(this.port);
  }

  setCloseCallback(handler: () => void | null) {
    (navigator as any).hid.removeEventListener("disconnect", this.closeCallback.bind(this));
    this.closeCallback = handler;
    (navigator as any).hid.addEventListener("disconnect", this.closeCallback.bind(this));
  }

  async open(onConnect: () => void | null, param: { filter: object }) {
    const request = await (navigator as any).hid.requestDevice({
      filters: param.filter,
    });
    console.log(request);
    this.port = request[0];

    if (!this.port) {
      return;
    }

    try {
      await this.port.open();
    } catch (e) {
      await this.port?.close();
      return Promise.reject(e);
    }

    if (onConnect) {
      onConnect();
    }

    // this.readLoop();

    console.log("open Raw HID port");
  }

  async writeString(msg: string) {
    this.port.sendReport(0, msg);
  }

  async write(msg: Uint8Array) {
    console.log(
      `send: ${Array.from(msg)
        .map((v) => v.toString(16))
        .join(" ")}`
    );
    this.port.sendReport(0, msg);
  }

  async close() {
    if (this.closeCallback) {
      this.closeCallback();
    }

    if (this.port) {
      try {
        this.port.removeEventListener("inputreport", this.receiveCallback);
        await this.port.close();
        this.port = null;
      } catch (e) {
        console.error(e);
      }
    }

    console.log("Raw HID port closed");
  }
}

export { WebRawHID };
