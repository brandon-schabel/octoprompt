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
import { useSelectedFiles, type UseSelectedFileReturn } from '@/hooks/utility-hooks/use-selected-files'

type SelectedFilesDrawerProps = {
  selectedFiles: string[]
  fileMap: Map<string, ProjectFile>
  onRemoveFile: (fileId: string) => void
  trigger?: React.ReactNode
  projectTabId: string
}


const getTotalFileTokens = ({ files, fileMap }: { files: string[], fileMap: Map<string, ProjectFile> }) => {
  return files.reduce((total, fileId) => {
    const file = fileMap.get(fileId)
    if (file?.content) {
      return total + estimateTokenCount(file.content)
    }
    return total
  }, 0)
}


export function SelectedFilesDrawer({
  onRemoveFile,
  trigger,
  projectTabId,
}: SelectedFilesDrawerProps) {

  const { selectedFiles, projectFileMap } = useSelectedFiles({ tabId: projectTabId })
  const [open, setOpen] = useState(false)

  const totalTokens = getTotalFileTokens({
    files: selectedFiles,
    fileMap: projectFileMap,
  })

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
            onRemoveFile={onRemoveFile}
            projectTabId={projectTabId}
          />
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}