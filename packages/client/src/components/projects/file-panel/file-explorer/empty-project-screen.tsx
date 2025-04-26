import { Button } from '@ui'
type EmptyProjectScreenProps = {
    fileSearch: string
    setFileSearch: (val: string) => void
    setSearchByContent: (val: boolean) => void
}

function EmptyProjectScreen({ fileSearch, setFileSearch, setSearchByContent }: EmptyProjectScreenProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            {fileSearch ? (
                <>
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
                    <Button variant="outline" size="sm" onClick={() => setSearchByContent(true)}>
                        Try searching file contents
                    </Button>
                </>
            ) : (
                <>
                    <p className="text-muted-foreground">This project appears to be empty.</p>
                    <p className="text-sm text-muted-foreground">
                        Make sure you&apos;ve selected the correct directory and it actually contains
                        files.
                    </p>
                </>
            )}
        </div>
    )
}

export { EmptyProjectScreen }