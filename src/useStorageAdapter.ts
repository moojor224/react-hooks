import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useDBCacheAdapter } from "./useIndexedDB";

type IDBConfig = {
    type: "IndexedDB";
    database: string;
    store: string;
};
type LocalStorageConfig = {
    type: "LocalStorage";
};
type CustomConfig<T = any> = {
    type: "custom";
    adapter: (props: T) => StorageAdapter;
    props: T;
};
type StorageConfig = IDBConfig | LocalStorageConfig | CustomConfig;

export type StorageAdapter = {
    /** size of the queue of pending storage operations */
    workSize: number;
    /** whether the storage adapter is ready to use */
    ready: boolean;
    /** true if the storage adapter had an error during initialization and can't be used */
    error: boolean;
    /** get a value from the storage adapter. should return undefined if the value is not set */
    getValue<T>(key: string): T;
    /** set a value in the storage adapter to the given value */
    setValue(key: string, value: any): void;
    /** delete a value from the storage adapter */
    deleteValue(key: string): void;
    /** get a list of all the keys stored in the storage adapter */
    keys(): string[];
};

//! note: do not turn on react linting, or eslint will go crazy abount dynamically calling hooks
/**
 * Create a {@link StorageAdapter} from the given options.
 * Options are locked in when useStorageAdapter is first called
 */
export function useStorageAdapter(config: StorageConfig): StorageAdapter {
    const type = config?.type;
    // this useState ensures that the storage type is locked in the first time the hook is called
    const [adapterType] = useState(type);
    if (adapterType !== type) {
        console.warn("storage adapter type change from '%s' to '%s' detected. ignoring", adapterType, type);
    }
    switch (adapterType) {
        case "IndexedDB": {
            const idbConfig = config as IDBConfig;
            // ensure that config values don't change if config changes
            const [database] = useState(idbConfig?.database);
            const [store] = useState(idbConfig?.store);
            const dbAdapter = useDBCacheAdapter(database, store);
            return dbAdapter;
        }
        case "LocalStorage": {
            const adapter = useMemo<StorageAdapter>(
                () =>
                    ({
                        ready: true,
                        error: false,
                        workSize: 0,
                        deleteValue(key) {
                            localStorage.removeItem(key);
                        },
                        getValue(key) {
                            return JSON.parse(localStorage.getItem(key) ?? "undefined");
                        },
                        keys() {
                            return new Array(localStorage.length).fill(0).map((_, i) => localStorage.key(i)!);
                        },
                        setValue(key, value) {
                            localStorage.setItem(key, JSON.stringify(value));
                        }
                    }) satisfies StorageAdapter,
                []
            );
            return adapter;
        }
        case "custom": {
            const customConfig = config as CustomConfig<any>;
            const [props] = useState(customConfig.props);
            const adapter = customConfig.adapter(props);
            return adapter;
        }
        default:
            console.warn("invalid storage adapter type: %o", type);
    }
    // fallback
    return localAdapter;
}

const localCache: Record<string, any> = {};
const localAdapter: StorageAdapter = {
    workSize: 0,
    ready: true,
    error: false,
    getValue<T>(key: string): T {
        return localCache[key];
    },
    setValue(key: string, value: any) {
        localCache[key] = value;
    },
    deleteValue(key: string) {
        delete localCache[key];
    },
    keys() {
        return Object.keys(localCache);
    }
};

/** Provides access to a {@link StorageAdapter} */
export const StorageContext = createContext(localAdapter);

function valueOrDefault<T>(val: T | null | undefined, def: T) {
    if (val === null || val === undefined) {
        return {
            usedDefault: true,
            value: def
        };
    }
    return {
        usedDefault: false,
        value: val
    };
}

/**
 * Access a value stored in a storage adapter.
 * Must be used inside of a {@link StorageContext} with a valid {@link StorageAdapter}
 */
export function useStoredValue<T>(key: string, initialValue: T) {
    const storageAdapter = useContext(StorageContext);
    const [stateVal, setStateVal] = useState(valueOrDefault(storageAdapter.getValue(key), initialValue).value);
    useEffect(() => {
        if (!storageAdapter.ready) return;
        const stored = storageAdapter.getValue(key);
        const val = valueOrDefault(stored, initialValue);
        if (val.usedDefault) {
            storageAdapter.setValue(key, val.value);
        }
        if (stored !== stateVal) {
            setStateVal(storageAdapter.getValue(key));
        }
    }, [storageAdapter.ready]);
    /** keeps track of state */
    const state = useMemo(
        () => ({
            value: stateVal
        }),
        []
    );
    return [
        state.value,
        function (arg0: T | ((last: T) => T)) {
            let v: T;
            if (typeof arg0 == "function") {
                v = (arg0 as (last: T) => T)(state.value);
            } else {
                v = arg0;
            }
            storageAdapter.setValue(key, v);
            setStateVal(v);
            state.value = v;
        }
    ] as const;
}
