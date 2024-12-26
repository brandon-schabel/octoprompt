import { estimateTokenCount } from "./projects/file-tree/utils/file-node-tree-utils"
import { useMemo } from "react"
import { clsx } from "clsx"
import { formatTokenCount } from "./projects/file-tree/utils/file-node-tree-utils"

/**
 * 
 * @param tokenContent - string or number - string if it's the raw content number if it's already been calculated
 * @returns 
 */
export const FormatTokenCount = ({ tokenContent }: { tokenContent: string | number }) => {
    const tokenCount = useMemo(() => {
        if (typeof tokenContent === 'string') {
            return estimateTokenCount(tokenContent)
        }
        return tokenContent
    }, [tokenContent])


    return (<span className={clsx("flex-shrink-0 text-xs text-muted-foreground", {
        "text-red-500": tokenCount > 3000,
        "text-yellow-500": tokenCount > 1500 && tokenCount < 3000,
        "text-green-500": tokenCount < 1500,
    })}>
        {formatTokenCount(tokenCount)}
    </span>)
}
