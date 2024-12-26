import { Link } from "@tanstack/react-router"
import { DarkModeToggle } from "./dark-mode-toggle"

export function HomeNavbar() {
    return (
        <nav className="bg-background border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <Link to="/" className="flex-shrink-0 flex items-center">
                            <span className="text-2xl font-bold text-primary">OctoPrompt</span>
                        </Link>
                    </div>
                    <div className="flex items-center">
                        <DarkModeToggle />
                    </div>
                </div>
            </div>
        </nav>
    )
}

