import React, { useState } from "react";
import {
  useGenerateFileChange,
  useGetFileChange,
  useConfirmFileChange,
} from "@/hooks/api/use-ai-file-changes-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoaderPinwheel } from "lucide-react";
import { DiffViewer } from "./diff-viewer";

interface AIFileChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath?: string;
  onSuccess?: () => void;
}

export function AIFileChangeDialog({
  open,
  onOpenChange,
  filePath = "",
  onSuccess,
}: AIFileChangeDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [changeId, setChangeId] = useState<number | null>(null);

  const generateMutation = useGenerateFileChange();
  const confirmMutation = useConfirmFileChange();
  const { data: change, isLoading: isLoadingChange } = useGetFileChange(changeId);

  const handleGenerate = async () => {
    if (!filePath) return;

    try {
      const result = await generateMutation.mutateAsync({
        filePath,
        prompt,
      });
      setChangeId(result.changeId);
    } catch (error) {
      console.error("Failed to generate change:", error);
    }
  };

  const handleConfirm = async () => {
    if (!changeId) return;

    try {
      await confirmMutation.mutateAsync(changeId);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to confirm change:", error);
    }
  };

  const handleClose = () => {
    setPrompt("");
    setChangeId(null);
    onOpenChange(false);
  };

  const isGenerating = generateMutation.isPending;
  const isConfirming = confirmMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>AI File Change</DialogTitle>
          <DialogDescription>
            Describe the changes you want to make to {filePath}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Prompt Section */}
          <div className="grid gap-2">
            <label htmlFor="prompt">What changes would you like to make?</label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the changes you want..."
              disabled={!!changeId}
              rows={4}
            />
          </div>

          {/* Once we have a changeId, show the suggested changes */}
          {changeId && (
            <div className="grid gap-2">
              <h3 className="font-medium">Suggested Changes</h3>
              {isLoadingChange ? (
                <div className="flex items-center justify-center p-4">
                  <LoaderPinwheel />
                </div>
              ) : change ? (
                // Show a diff between originalContent and suggestedDiff
                <DiffViewer
                  oldValue={change.originalContent}
                  newValue={change.suggestedDiff}
                />
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    Failed to load the suggested changes.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {!changeId ? (
            <Button
              onClick={handleGenerate}
              disabled={!prompt || isGenerating}
            >
              {isGenerating ? <LoaderPinwheel className="mr-2" /> : null}
              Generate Changes
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={isConfirming || !change}
              variant="default"
            >
              {isConfirming ? <LoaderPinwheel className="mr-2" /> : null}
              Confirm &amp; Apply Changes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}