import { toast } from "sonner";

function middleware(err: Error): void {
    if (
        err.message === "Signature has expired" ||
        err.message === "Authentication Failure : You must be signed in"
    ) {
        localStorage.clear();
        window.location.href = "/";
    } else {
        toast.error(err.message);
    }
}

export { middleware };