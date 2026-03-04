import { useState } from "react";

export function useBluetoothDevice<T extends readonly string[]>(serviceUUID: string, characteristicIds: T) {
    const [canBLE] = useState(() => {
        if (!("bluetooth" in navigator) && !canBLE) {
            console.error("bluetooth not supported");
            return false;
        } else {
            return true;
        }
    });
    const [bleDevice, setBLEDevice] = useState<BluetoothDevice | null>(null);
    const [characteristics, setCharacteristics] = useState<(BluetoothRemoteGATTCharacteristic | undefined)[]>([]);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectError, setConnectError] = useState("");
    function reset() {
        setConnectError("");
        setBLEDevice(null);
        setIsConnecting(false);
        setCharacteristics([]);
    }
    function connect() {
        if ("bluetooth" in navigator) {
            navigator.bluetooth
                .requestDevice({
                    filters: [{ services: [serviceUUID] }]
                    // optionalServices: [serviceUUID],
                    // acceptAllDevices: true
                })
                .then(function (d) {
                    let maxTries = 5;
                    let curTries = 0;
                    function connectToDevice(device: BluetoothDevice, err?: Error) {
                        if (curTries >= maxTries) {
                            reset();
                            console.error(`couldn't connect to ${device.name} after ${maxTries} tries`);
                            return;
                        }
                        setIsConnecting(true);
                        curTries++;
                        // console.info(`attempting to connect to ${device.name}... ${curTries}/${maxTries} tries`);
                        // console.debug("device", device);
                        device.addEventListener("gattserverdisconnected", function () {
                            console.debug("disconnected");
                            reset();
                        });
                        return device.gatt
                            ?.connect()
                            .then((server) => {
                                return server.getPrimaryService(serviceUUID); // get bluetooth service
                            })
                            .then((service) => {
                                return Promise.all(characteristicIds.map((e) => service.getCharacteristic(e)));
                            })
                            .then((chars) => {
                                setCharacteristics(chars);
                                setIsConnecting(false);
                                setBLEDevice(device);
                            })
                            .catch((e) => {
                                console.warn("couldn't connect due to error. trying again");
                                console.error(e);
                                setBLEDevice(null);
                                setCharacteristics([]);
                                connectToDevice(device);
                            });
                    }
                    connectToDevice(d);
                });
        }
    }
    return {
        /** whether the browser supports connecting to a bluetooth device */
        canBLE,
        /** Show the bluetooth device connection system dialog */
        connect,
        /** Array of characteristics derived from given ids */
        characteristics,
        /** the bluetooth device */
        device: bleDevice,
        /** whether the hook is in the process of connecting to the device */
        isConnecting,
        connectError
    };
}
