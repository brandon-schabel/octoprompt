import { Button } from "@/components/ui/button"

type NoResultsScreenProps = {
    fileSearch: string
    searchByContent: boolean
    setFileSearch: (val: string) => void
    setSearchByContent: (val: boolean) => void
}

function NoResultsScreen({
    fileSearch,
    searchByContent,
    setFileSearch,
    setSearchByContent,
}: NoResultsScreenProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            <p className="text-muted-foreground">
                No files found matching &quot;{fileSearch}&quot;
            </p>
            <p className="text-sm text-muted-foreground">
                Try adjusting your search or{' '}
                <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => {
                        setFileSearch('')
                        setSearchByContent(false)
                    }}
                >
                    clear the search
                </Button>
            </p>
            {!searchByContent && (
                <Button variant="outline" size="sm" onClick={() => setSearchByContent(true)}>
                    Try searching file contents
                </Button>
            )}
        </div>
    )
}

export { NoResultsScreen }