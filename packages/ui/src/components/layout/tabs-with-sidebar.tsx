import * as React from 'react'
import { cn } from '../../utils'
import { ScrollArea } from '../data/scroll-area'
import { Button } from '../core/button'
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '../core/sheet'

export interface TabItem {
  id: string
  label: string
  icon?: React.ReactNode
  content: React.ReactNode
  disabled?: boolean
}

export interface TabSection {
  title?: string
  items: TabItem[]
}

export interface TabsWithSidebarProps {
  /**
   * Tab sections to display in the sidebar
   */
  sections?: TabSection[]
  /**
   * Simple tab items (when not using sections)
   */
  tabs?: TabItem[]
  /**
   * Currently active tab ID
   */
  activeTab: string
  /**
   * Callback when tab changes
   */
  onTabChange: (tabId: string) => void
  /**
   * Width of the sidebar
   * @default "16rem" (w-64)
   */
  sidebarWidth?: string
  /**
   * Whether the sidebar is collapsible
   * @default true
   */
  collapsible?: boolean
  /**
   * Whether to show mobile drawer on small screens
   * @default true
   */
  showMobileDrawer?: boolean
  /**
   * Custom className for the container
   */
  className?: string
  /**
   * Custom className for the sidebar
   */
  sidebarClassName?: string
  /**
   * Custom className for the content area
   */
  contentClassName?: string
  /**
   * Header content for the sidebar
   */
  sidebarHeader?: React.ReactNode
  /**
   * Footer content for the sidebar
   */
  sidebarFooter?: React.ReactNode
}

const SidebarContent: React.FC<{
  sections?: TabSection[]
  tabs?: TabItem[]
  activeTab: string
  onTabChange: (tabId: string) => void
  sidebarHeader?: React.ReactNode
  sidebarFooter?: React.ReactNode
}> = ({ sections, tabs, activeTab, onTabChange, sidebarHeader, sidebarFooter }) => {
  const renderTabItem = (tab: TabItem) => (
    <Button
      key={tab.id}
      variant={activeTab === tab.id ? 'secondary' : 'ghost'}
      className={cn(
        'w-full justify-start gap-2 text-left',
        activeTab === tab.id && 'bg-muted font-medium'
      )}
      onClick={() => !tab.disabled && onTabChange(tab.id)}
      disabled={tab.disabled}
    >
      {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
      <span className="truncate">{tab.label}</span>
    </Button>
  )

  return (
    <>
      {sidebarHeader && (
        <div className="p-4 border-b">
          {sidebarHeader}
        </div>
      )}
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {sections ? (
            sections.map((section, index) => (
              <div key={index} className="space-y-1">
                {section.title && (
                  <h3 className="px-3 py-2 text-sm font-semibold text-muted-foreground">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map(renderTabItem)}
                </div>
              </div>
            ))
          ) : tabs ? (
            <div className="space-y-1">
              {tabs.map(renderTabItem)}
            </div>
          ) : null}
        </div>
      </ScrollArea>

      {sidebarFooter && (
        <div className="p-4 border-t">
          {sidebarFooter}
        </div>
      )}
    </>
  )
}

export const TabsWithSidebar = React.forwardRef<HTMLDivElement, TabsWithSidebarProps>(
  (
    {
      sections,
      tabs,
      activeTab,
      onTabChange,
      sidebarWidth = '16rem',
      collapsible = true,
      showMobileDrawer = true,
      className,
      sidebarClassName,
      contentClassName,
      sidebarHeader,
      sidebarFooter
    },
    ref
  ) => {
    const [isCollapsed, setIsCollapsed] = React.useState(false)

    // Find the active tab content
    const activeTabContent = React.useMemo(() => {
      const allTabs = sections 
        ? sections.flatMap(s => s.items)
        : tabs || []
      
      return allTabs.find(t => t.id === activeTab)?.content
    }, [sections, tabs, activeTab])

    return (
      <div ref={ref} className={cn('flex h-full', className)}>
        {/* Mobile Drawer */}
        {showMobileDrawer && (
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="fixed bottom-4 right-4 z-40 lg:hidden"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SidebarContent
                  sections={sections}
                  tabs={tabs}
                  activeTab={activeTab}
                  onTabChange={onTabChange}
                  sidebarHeader={sidebarHeader}
                  sidebarFooter={sidebarFooter}
                />
              </SheetContent>
            </Sheet>
          </div>
        )}

        {/* Desktop Sidebar */}
        <div
          className={cn(
            'hidden lg:flex flex-col border-r bg-muted/30 transition-all duration-300',
            isCollapsed ? 'w-0 overflow-hidden' : 'flex-shrink-0',
            sidebarClassName
          )}
          style={{ width: isCollapsed ? 0 : sidebarWidth }}
        >
          <SidebarContent
            sections={sections}
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
            sidebarHeader={sidebarHeader}
            sidebarFooter={sidebarFooter}
          />
        </div>

        {/* Collapse Toggle Button */}
        {collapsible && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'hidden lg:flex absolute top-4 z-10 h-6 w-6 rounded-full border bg-background shadow-sm transition-all duration-300',
              isCollapsed ? 'left-2' : 'left-[15rem]'
            )}
            style={{ left: isCollapsed ? '0.5rem' : `calc(${sidebarWidth} - 1rem)` }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </Button>
        )}

        {/* Content Area */}
        <div className={cn('flex-1 overflow-auto', contentClassName)}>
          {activeTabContent}
        </div>
      </div>
    )
  }
)

TabsWithSidebar.displayName = 'TabsWithSidebar'