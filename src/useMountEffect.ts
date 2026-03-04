import type { DependencyList, EffectCallback } from "react";
import { useEffect, useState } from "react";

/**
 * Has the same functionality as React.useEffect, but only runs once when the component is initially mounted
 * @param callback
 * @param deps
 */
export function useMountEffect(callback: EffectCallback, deps: DependencyList = []) {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        if (isMounted) return;
        setIsMounted(true);
        return callback();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callback, isMounted, ...deps]);
}
