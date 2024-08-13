import { WebUsbComInterface } from "./webUsbComInterface";

class WebRawHID implements WebUsbComInterface {
  private receiveCallback: ((msg: HIDInputReportEvent) => void) | null = null;
  private closeCallback: (() => void) = () => { };

  private port: HIDDevice | null = null;
  private reportId: number = 0;

  get connected() {
    return this.port?.opened ?? false;
  }

  constructor() {
    navigator.hid.addEventListener("disconnect", this.closeCallback.bind(this));
  }

  setReceiveCallback(recvHandler: ((msg: Uint8Array) => void) | null) {
    if (this.receiveCallback) this.port?.removeEventListener("inputreport", this.receiveCallback);
    this.receiveCallback = (e: HIDInputReportEvent) => {
      recvHandler?.(new Uint8Array((e.data as DataView).buffer));
    };
    this.port?.addEventListener("inputreport", this.receiveCallback);
    console.log(this.port);
  }

  setCloseCallback(handler: () => void | null) {
    navigator.hid.removeEventListener("disconnect", this.closeCallback.bind(this));
    this.closeCallback = handler;
    navigator.hid.addEventListener("disconnect", this.closeCallback.bind(this));
  }

  async open(onConnect: () => void | null, param: HIDDeviceFilter[]) {
    const request = await navigator.hid.requestDevice({
      filters: param
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

    this.reportId = this.port.collections.find(info => info.outputReports?.[0]?.reportId ?? 0 > 0)?.outputReports?.[0]?.reportId ?? 0;
    console.log(`Report Id: ${this.reportId}`);

    if (onConnect) {
      onConnect();
    }

    // this.readLoop();

    console.log("open Raw HID port");
  }

  getName() {
    return this.port?.productName ?? "";
  }

  async writeString(msg: string) {
    const encoder = new TextEncoder()
    this.port?.sendReport(this.reportId, encoder.encode(msg));
  }

  async write(msg: Uint8Array) {
    console.log(
      `send: ${Array.from(msg)
        .map((v) => v.toString(16))
        .join(" ")}`
    );
    try {
      await this.port?.sendReport(this.reportId, msg);
    }
    catch (e) {
      console.error(e)
    }
  }

  async close() {
    if (this.closeCallback) {
      this.closeCallback();
    }

    if (this.port) {
      try {
        this.port.removeEventListener("inputreport", this.receiveCallback!);
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
