import { Alert } from "@mui/material";
import { useEffect, useState } from "react";
import "./errorpopup.css";

export type ErrorMessage = {
    /**
     * 0: fade in
     * 1: displayed
     * 2: fade out
     */
    state: 0 | 1 | 2;
    bound: boolean;
    message: string;
    error: Error;
    severity: "error" | "warning";
};

export function ErrorPopup({
    errors,
    setErrors
}: {
    errors: (ErrorMessage | false)[];
    setErrors: (arg0: (errs: (ErrorMessage | false)[]) => (ErrorMessage | false)[]) => void;
}) {
    console.log(errors);
    const [, reload] = useState(0);
    useEffect(() => {
        errors.forEach((error, idx) => {
            if (!error) return;
            if (error.bound) return;
            error.bound = true;
            if (error.state == 0) {
                error.bound = true;
                reload((v) => v + 1);
                setTimeout(() => {
                    error.state = 1;
                    reload((v) => v + 1);
                    setTimeout(() => {
                        error.state = 2;
                        reload((v) => v + 1);
                        setTimeout(() => {
                            console.log("deleting error", idx);
                            setErrors((e) => {
                                e.splice(idx, 1, false);
                                return e;
                            });
                            reload((v) => v + 1);
                        }, 250);
                    }, 5000);
                });
            }
        });
    }, [errors]);
    return (
        <div className="error-feed">
            {errors.map((err, idx) =>
                err ? (
                    <div
                        key={idx}
                        className={
                            "error-feed-item " + (err.state == 0 ? fadeInClass : err.state == 2 ? fadeOutClass : displayedClass)
                        }
                    >
                        <Alert severity={err.severity}>{err.message}</Alert>
                    </div>
                ) : null
            )}
        </div>
    );
}

const fadeInClass = "fade-in";
const displayedClass = "";
const fadeOutClass = "fade-out";

function App() {
    const [errors, setErrors] = useState<(ErrorMessage | false)[]>([]);
    useEffect(() => {
        async function handleError(event: ErrorEvent) {
            event.preventDefault();
            let { filename: source, lineno, colno, error, message } = event;
            let fileSrc = (
                await fetch(source)
                    .then((r) => r.text())
                    .catch(() => source)
            )
                .replaceAll("\r", "")
                .replaceAll("%", "%%")
                .split("\n");
            console.groupCollapsed(`Error in ${source} on line ${lineno}`);
            console.error(error);
            let startLine = Math.max(0, lineno - 6);
            let endLine = Math.min(fileSrc.length, lineno + 5);
            const sliced = fileSrc.slice(startLine, endLine);
            console.log(
                sliced
                    .map(
                        (e, i) =>
                            (i + startLine + 1 == lineno ? "%c> " : "  ") +
                            (i + startLine + 1) +
                            ": " +
                            (i + startLine + 1 == lineno
                                ? e.slice(0, colno - 1) + "%c" + e[colno - 1] + "%c" + e.slice(colno)
                                : "") +
                            (i + startLine + 1 == lineno ? "%c" : e)
                    )
                    .join("\n"),
                highlightStyle,
                underlineStyle,
                highlightStyle,
                ""
            );
            console.groupEnd();
            setErrors((errs) =>
                errs.concat({
                    bound: false,
                    error: error,
                    message: error?.message || "",
                    severity: "error",
                    state: 0
                })
            );
        }
        window.addEventListener("error", handleError);
        return () => {
            window.removeEventListener("error", handleError);
        };
    }, []);
    return (
        <div>
            <ErrorPopup errors={errors} setErrors={setErrors} />
            <Button
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0
                }}
                onClick={() => {
                    throw new Error("button click error");
                }}
            >
                throw error
            </Button>
        </div>
    );
}
