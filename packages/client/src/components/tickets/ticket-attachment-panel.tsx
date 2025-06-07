// Recent changes:
// 1. Optimized to use useGetProjectFilesWithoutContent instead of requiring full ProjectFile[] props
// 2. Updated interface to accept metadata-only files (without content) for performance
// 3. Added projectId prop to fetch files directly instead of receiving them as props
// 4. Removed dependency on external projectFiles prop for better encapsulation
// 5. Enhanced error handling for file fetching
import React from 'react'
import { useLinkFilesToTicket } from '../../hooks/api/use-tickets-api'
import { useGetProjectFilesWithoutContent } from '../../hooks/api/use-projects-api'
import type { ProjectFile } from '@octoprompt/schemas'

interface TicketAttachmentsPanelProps {
  ticketId: number
  projectId: number
}

export function TicketAttachmentsPanel({ ticketId, projectId }: TicketAttachmentsPanelProps) {
  const [selectedFiles, setSelectedFiles] = React.useState<number[]>([])
  const { mutateAsync: linkFiles, isPending } = useLinkFilesToTicket()
  
  // Use optimized hook that fetches only file metadata (id, name, path) without content
  const { data: projectFiles, isLoading, error } = useGetProjectFilesWithoutContent(projectId)

  function toggleFile(fileId: number) {
    setSelectedFiles((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]))
  }

  async function handleLink() {
    try {
      await linkFiles({ ticketId, fileIds: selectedFiles })
      alert('Files linked successfully!')
    } catch (err) {
      console.error('Failed to link files:', err)
    }
  }

  if (isLoading) {
    return (
      <div className='mt-4 border p-3 rounded space-y-2'>
        <h3 className='font-semibold'>Attach Files</h3>
        <div className='text-sm text-gray-500'>Loading files...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='mt-4 border p-3 rounded space-y-2'>
        <h3 className='font-semibold'>Attach Files</h3>
        <div className='text-sm text-red-500'>Failed to load files. Please try again.</div>
      </div>
    )
  }

  const files = projectFiles?.data || []

  return (
    <div className='mt-4 border p-3 rounded space-y-2'>
      <h3 className='font-semibold'>Attach Files</h3>
      <div className='max-h-40 overflow-auto border rounded p-2'>
        {files.map((file) => {
          const checked = selectedFiles.includes(file.id)
          return (
            <label key={file.id} className='block cursor-pointer'>
              <input type='checkbox' checked={checked} onChange={() => toggleFile(file.id)} />
              <span className='ml-2'>{file.name}</span>
            </label>
          )
        })}
      </div>
      <button
        onClick={handleLink}
        disabled={isPending || selectedFiles.length === 0}
        className='bg-green-500 text-white px-4 py-1 rounded'
      >
        {isPending ? 'Linking...' : 'Link Selected Files'}
      </button>
    </div>
  )
}
