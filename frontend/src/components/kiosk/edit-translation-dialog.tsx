import * as React from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"

interface EditTranslationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialText: string
  isSaving: boolean
  onSave: (newText: string) => void
}

export function EditTranslationDialog({
  open,
  onOpenChange,
  initialText,
  isSaving,
  onSave,
}: EditTranslationDialogProps) {
  const [text, setText] = React.useState(initialText)

  React.useEffect(() => {
    if (open) setText(initialText)
  }, [open, initialText])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSave(trimmed)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Chỉnh Sửa Nội Dung Khai Báo"
      description="Nhập hoặc điều chỉnh lại câu tiếng Việt nếu bạn muốn bổ sung thêm chi tiết cho Bác sĩ."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="patient-custom-text"
            className="text-sm font-medium text-foreground"
          >
            Nội dung triệu chứng / yêu cầu của bạn
          </label>
          <textarea
            id="patient-custom-text"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ví dụ: Tôi bị đau bụng âm ỉ từ tối qua, có tiền sử dị ứng kháng sinh..."
            className="w-full rounded-xl border bg-background p-3 text-base text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button type="submit" loading={isSaving} disabled={!text.trim()}>
            <Check />
            Cập Nhật Nội Dung
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

