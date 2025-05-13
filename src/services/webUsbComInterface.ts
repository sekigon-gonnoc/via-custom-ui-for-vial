export interface WebUsbComInterface {
  connected: boolean;
  setReceiveCallback(recvHandler: ((msg: Uint8Array) => void) | null): void;
  setCloseCallback(handler: () => void | null): void;
  getDeviceList(): Promise<
    {
      name: string;
      vid: number;
      pid: number;
      opened: boolean;
      usage: number[];
      usagePage: number[];
    }[]
  >;
  open(deviceIndex: number, onConnect: () => void | null, param: object): Promise<void>;
  close(): Promise<void>;
  writeString(msg: string): Promise<void>;
  write(msg: Uint8Array): Promise<void>;
  getName(): string;
}
