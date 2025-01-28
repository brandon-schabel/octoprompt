import * as React from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { estimateTokenCount } from "@/components/projects/file-panel/file-tree/file-tree-utils/file-node-tree-utils"
import { ProjectFile } from "shared"
import { SelectedFilesList } from "@/components/projects/selected-files-list"
import { useState } from "react"
import { FormatTokenCount } from "../format-token-count"
import { Badge } from "../ui/badge"
import { type UseSelectedFileReturn } from '@/hooks/utility-hooks/use-selected-files'

type SelectedFilesDrawerProps = {
  selectedFiles: string[]
  fileMap: Map<string, ProjectFile>
  onRemoveFile: (fileId: string) => void
  trigger?: React.ReactNode
  projectTabId: string
  selectedFilesState: UseSelectedFileReturn
}

export function SelectedFilesDrawer({
  selectedFiles,
  fileMap,
  onRemoveFile,
  trigger,
  projectTabId,
  selectedFilesState
}: SelectedFilesDrawerProps) {
  const [open, setOpen] = useState(false)

  const totalTokens = React.useMemo(() => {
    return selectedFiles.reduce((total, fileId) => {
      const file = fileMap.get(fileId)
      if (file?.content) {
        return total + estimateTokenCount(file.content)
      }
      return total
    }, 0)
  }, [selectedFiles, fileMap])

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <Button variant="outline" className="relative">
            {selectedFiles.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                {selectedFiles.length}
              </span>
            )}
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="flex justify-between items-center">
            <span>
              <Badge variant="secondary">{selectedFiles.length}</Badge> Selected Files
            </span>

            <FormatTokenCount tokenContent={totalTokens} />
          </DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="p-4 h-[50vh]">
          <SelectedFilesList
            selectedFiles={selectedFiles}
            fileMap={fileMap}
            onRemoveFile={onRemoveFile}
            projectTabId={projectTabId}
            selectedFilesState={selectedFilesState}
          />
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}