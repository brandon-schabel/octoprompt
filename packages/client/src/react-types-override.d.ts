import "react"

declare module "react" {
    interface FormStatus {
        pending: boolean;
        data: FormData | null; // null when there's no active submission
        method: "get" | "post" | null; // null when there's no parent <form>
        action: ((...args: any[]) => unknown) | null; // null if no parent <form> or a URI-based action
    }

    // The hook itself
    export function useFormStatus(): FormStatus;
}
