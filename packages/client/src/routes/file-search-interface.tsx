import { useActiveProjectTab } from '@/websocket-state/hooks/selectors/websocket-selector-hoooks';
import { useGeminiFileSearch } from '@/hooks/api/use-gemini-file-search';
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react';

export const Route = createFileRoute('/file-search-interface')({
    component: FileSearchInterface,
})

function FileSearchInterface() {
    const [query, setQuery] = useState('');
    const { status, result, error, search, reset } = useGeminiFileSearch();
    const { tabData: activeProjectTabState } = useActiveProjectTab()

    const selectedProjectId = activeProjectTabState?.selectedProjectId

    const handleSearch = () => {
        search({ projectId: selectedProjectId || '', query });
    };

    return (
        <div>
            <h3>Gemini File Search </h3>
            < div > Status: {status} </div>
            {error && <div>Error: {error} </div>}
            <div>
                <input
                    type="text"
                    placeholder="Enter your query"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
                <button onClick={handleSearch} disabled={status === 'connecting' || status === 'streaming'
                }>
                    Search
                </button>
                < button onClick={reset} > Reset </button>
            </div>
            < pre > {result} </pre>
        </div>
    );
}