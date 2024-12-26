import { Link } from "@tanstack/react-router"

export function HomeNavbar() {
    return (
        <nav className="shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <Link to="/" className="flex-shrink-0 flex items-center">
                            <span className="text-2xl font-bold text-indigo-600">OctoPrompt</span>
                        </Link>
                    </div>
                    <div className="flex items-center">
                        <Link to="/chat" search={{ prefill: false }} className="text-gray-700 dark:text-white hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium">
                            Chat
                        </Link>
                        <Link to="/projects" className="text-gray-700 dark:text-white hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium">
                            Projects
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    )
}

