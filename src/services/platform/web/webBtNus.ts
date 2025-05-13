import { WebUsbComInterface } from "../../webUsbComInterface";

// Nordic UART Service UUIDs
const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // TX from central to peripheral
const NUS_RX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // RX from peripheral to central

class WebBtNus implements WebUsbComInterface {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | undefined = undefined;
  private nusService: BluetoothRemoteGATTService | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private receiveCallback: ((msg: Uint8Array) => void) | null = null;
  private closeCallback: () => void = () => {};
  private rxListenerAdded: boolean = false;
  private disconnectListenerAdded: boolean = false;
  
  // Reference to event handlers for removal
  private onCharacteristicValueChanged = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) {
      this.receiveCallback?.(new Uint8Array(value.buffer));
    }
  };
  
  private onGattServerDisconnected = () => {
    this.closeCallback();
  };

  get connected(): boolean {
    return this.device !== null && this.server?.connected === true;
  }

  setReceiveCallback(recvHandler: ((msg: Uint8Array) => void) | null): void {
    this.receiveCallback = recvHandler;

    if (this.rxCharacteristic) {
      // Remove existing listener if present
      if (this.rxListenerAdded) {
        this.rxCharacteristic.removeEventListener("characteristicvaluechanged", this.onCharacteristicValueChanged);
        this.rxListenerAdded = false;
      }
      
      if (recvHandler) {
        // Start notifications and add listener
        this.rxCharacteristic
          .startNotifications()
          .then(() => {
            this.rxCharacteristic?.addEventListener("characteristicvaluechanged", this.onCharacteristicValueChanged);
            this.rxListenerAdded = true;
          })
          .catch((error) => {
            console.error("Error starting notifications:", error);
          });
      } else {
        // Stop notifications if callback is removed
        this.rxCharacteristic.stopNotifications().catch((e) => console.error(e));
      }
    }
  }

  setCloseCallback(handler: (() => void) | null): void {
    this.closeCallback = handler || (() => {});

    if (this.device) {
      // Remove existing listener if present
      if (this.disconnectListenerAdded) {
        this.device.removeEventListener("gattserverdisconnected", this.onGattServerDisconnected);
        this.disconnectListenerAdded = false;
      }
      
      // Add new listener
      this.device.addEventListener("gattserverdisconnected", this.onGattServerDisconnected);
      this.disconnectListenerAdded = true;
    }
  }

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
    return []
  }

  async open(deviceIndex: number, onConnect: (() => void) | null, _param: object): Promise<void> {

    try {
    const devices = [undefined]
      this.device =
        devices.at(deviceIndex) ?? 
        (await navigator.bluetooth.requestDevice({
          filters: [
            {
              namePrefix:"(BMP)"
            },
          ],
          optionalServices: [NUS_SERVICE_UUID],
        }));

      // Connect to GATT server
      this.server = await this.device.gatt?.connect();
      if (!this.server) {
        throw new Error("Failed to connect to GATT server");
      }

      // Get NUS service
      this.nusService = await this.server.getPrimaryService(NUS_SERVICE_UUID);

      // Get TX and RX characteristics
      this.txCharacteristic = await this.nusService.getCharacteristic(NUS_TX_CHARACTERISTIC_UUID);
      this.rxCharacteristic = await this.nusService.getCharacteristic(NUS_RX_CHARACTERISTIC_UUID);

      // Set up disconnect listener
      if (this.disconnectListenerAdded) {
        this.device.removeEventListener("gattserverdisconnected", this.onGattServerDisconnected);
      }
      this.device.addEventListener("gattserverdisconnected", this.onGattServerDisconnected);
      this.disconnectListenerAdded = true;

      // Setup receive callback if already defined
      if (this.receiveCallback) {
        this.setReceiveCallback(this.receiveCallback);
      }

      // Call onConnect callback if provided
      if (onConnect) {
        onConnect();
      }

      console.log("BLE NUS connection opened");
    } catch (error) {
      console.error("Error opening BLE NUS connection:", error);
      await this.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      // Clean up notification listeners
      if (this.rxCharacteristic) {
        if (this.rxListenerAdded) {
          this.rxCharacteristic.removeEventListener("characteristicvaluechanged", this.onCharacteristicValueChanged);
          this.rxListenerAdded = false;
        }
        await this.rxCharacteristic.stopNotifications().catch((e) => console.error(e));
      }

      // Clean up disconnect listener
      if (this.device && this.disconnectListenerAdded) {
        this.device.removeEventListener("gattserverdisconnected", this.onGattServerDisconnected);
        this.disconnectListenerAdded = false;
      }

      if (this.server && this.server.connected) {
        this.server.disconnect();
      }

      // Reset state
      this.device = null;
      this.server = undefined;
      this.nusService = null;
      this.txCharacteristic = null;
      this.rxCharacteristic = null;

      console.log("BLE NUS connection closed");
    } catch (error) {
      console.error("Error closing BLE NUS connection:", error);
    }
  }

  async writeString(msg: string): Promise<void> {
    if (!this.connected || !this.txCharacteristic) {
      throw new Error("Not connected");
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(msg);
      await this.write(data);
    } catch (error) {
      console.error("Error writing string to BLE NUS:", error);
      throw error;
    }
  }

  async write(msg: Uint8Array): Promise<void> {
    if (!this.connected || !this.txCharacteristic) {
      throw new Error("Not connected");
    }

    try {
      console.log(
        `BLE NUS send: ${Array.from(msg)
          .map((v) => v.toString(16))
          .join(" ")}`,
      );

      // BLE standard MTU size
      const MTU_SIZE = 20;

      // Process the data in chunks of MTU_SIZE
      for (let i = 0; i < msg.length; i += MTU_SIZE) {
        // Create a chunk of data
        const chunkSize = Math.min(MTU_SIZE, msg.length - i);
        const chunk = new Uint8Array(MTU_SIZE); // Always create a 20-byte array

        // Copy actual data
        chunk.set(msg.slice(i, i + chunkSize));

        // The rest will remain as zeros (padding)

        // Write the 20-byte chunk
        await this.txCharacteristic.writeValue(chunk);
      }

      // If the input message was empty or its length was exactly a multiple of MTU_SIZE,
      // we still need to send at least one packet
      if (msg.length === 0 || msg.length % MTU_SIZE === 0) {
        const emptyChunk = new Uint8Array(MTU_SIZE); // 20 bytes of zeros
        await this.txCharacteristic.writeValue(emptyChunk);
      }
    } catch (error) {
      console.error("Error writing to BLE NUS:", error);
      throw error;
    }
  }

  getName(): string {
    return this.device?.name || "";
  }
}

export { WebBtNus };

