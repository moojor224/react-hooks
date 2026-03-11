import { ConcurrencyLimiter } from "@moojor224/promise-limiter";
import { useEffect, useMemo, useState } from "react";
import type { StorageAdapter } from "./useStorageAdapter";

type DB =
    | {
          ready: true;
          database: IDBDatabase;
          error: boolean;
      }
    | {
          ready: false;
          database: null;
          error: boolean;
      };

/** sets up connection to IDB */
function useIndexedDB(dbName: string, storeName: string, version: number): DB {
    const [db, setDB] = useState<IDBDatabase | null>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        // effect runs once on mount
        const request = indexedDB.open(dbName, version); // request open db
        request.onupgradeneeded = function () {
            // if successfully opened
            request.result.createObjectStore(storeName); // create app's object store
        };
        request.onsuccess = function () {
            setDB(request.result);
        };
        request.onerror = function () {
            setError(true);
        };
    }, []);
    return {
        /** true if database is ready */
        ready: !!db,
        /** the database */
        database: db,
        /** whether the db init failed */
        error
    } as DB;
}

/** downloads database into cache object for instant getValue */
function useDBCache(db: IDBDatabase | null, storeName: string) {
    const [initialized, setInitialized] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const cache: Record<string, any> = useMemo(() => ({}), []);

    useEffect(() => {
        if (initialized || !db) return;
        const tr = db.transaction(storeName, "readwrite");
        const store = tr.objectStore(storeName);
        // store.put("value", "key");
        const keyreq = store.getAllKeys();
        keyreq.onerror = function () {
            setError(keyreq.error);
        };
        keyreq.onsuccess = function () {
            const keys = keyreq.result.map((e) => e.toString());
            Promise.allSettled<{ key: string; value: any }>(
                keys.map(
                    (e) =>
                        new Promise((resolve, reject) => {
                            const getreq = store.get(e);
                            getreq.onsuccess = function () {
                                resolve({ key: e, value: getreq.result });
                            };
                            getreq.onerror = function () {
                                reject();
                            };
                        })
                )
            ).then((values) => {
                values.forEach((v) => {
                    if (v.status === "fulfilled") {
                        cache[v.value.key] = v.value.value;
                    }
                });
                setInitialized(true);
            });
        };
    }, [db, initialized]);
    return {
        initialized,
        cache,
        error
    };
}

const limit = new ConcurrencyLimiter(1);

/** getters/setters for IDB cache */
export function useDBCacheAdapter(dbName: string, storeName: string): StorageAdapter {
    const database = useIndexedDB(dbName, storeName, 1);
    const cache = useDBCache(database.database, storeName);
    const work = useMemo(() => ({ size: 0 }), []);
    return {
        work,
        ready: database.ready && cache.initialized,
        error: database.error || !!cache.error,
        getValue<T>(key: string): T {
            return cache.cache[key];
        },
        setValue(key: string, value: any) {
            work.size++;
            cache.cache[key] = value;
            // queue database action
            limit.run(
                () =>
                    new Promise<void>(function queue(resolve) {
                        const db = database.database;
                        if (db) {
                            const tr = db.transaction(storeName, "readwrite");
                            const store = tr.objectStore(storeName);
                            const setReq = store.put(value, key);
                            setReq.onsuccess = function () {
                                work.size--;
                                resolve();
                            };
                            setReq.onerror = function () {
                                console.error(setReq.error);
                                work.size--;
                                resolve();
                            };
                        }
                    })
            );
        },
        deleteValue(key: string) {
            work.size++;
            delete cache.cache[key];
            // queue database action
            limit.run(
                () =>
                    new Promise<void>(function queue(resolve) {
                        const db = database.database;
                        if (db) {
                            const tr = db.transaction(storeName, "readwrite");
                            const store = tr.objectStore(storeName);
                            const delReq = store.delete(key);
                            delReq.onsuccess = function () {
                                work.size--;
                                resolve();
                            };
                            delReq.onerror = function () {
                                console.error(delReq.error);
                                work.size--;
                                resolve();
                            };
                        }
                    })
            );
        },
        keys() {
            return Object.keys(cache.cache);
        }
    };
}
