import { toast } from "sonner";
import { ApiError } from "shared/index";

const constructErrorMessage = (error: ApiError) => {
    return `API Error [${error.code}]: ${error.message}`
}

export const commonErrorHandler = (error: Error) => {
    if (error instanceof ApiError) {
        const message = constructErrorMessage(error);

        toast(message);
    }
}
