"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Check, Mail, Users, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type PayrollRecord = {
    id: string
    employee_name?: string
    net_pay?: number
    total_net?: number
    status: string
}

type PayrollNotifyDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    periodName: string
    records: PayrollRecord[]
}

export function PayrollNotifyDialog({
    open,
    onOpenChange,
    periodName,
    records,
}: PayrollNotifyDialogProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isSending, setIsSending] = useState(false)

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(records.map((r) => r.id))
        } else {
            setSelectedIds([])
        }
    }

    const toggleRecord = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        )
    }

    const handleSend = async () => {
        if (selectedIds.length === 0) {
            toast.error("Please select at least one employee")
            return
        }

        setIsSending(true)
        const toastId = toast.loading(`Sending notifications to ${selectedIds.length} employees...`)

        try {
            const response = await fetch("/api/payroll/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recordIds: selectedIds }),
            })

            const data = await response.json()

            if (!response.ok) throw new Error(data.error || "Failed to send notifications")

            toast.success(
                `Successfully sent ${data.summary.success} notifications!${data.summary.failed > 0 ? ` (${data.summary.failed} failed)` : ""
                }`,
                { id: toastId, duration: 5000 }
            )
            onOpenChange(false)
        } catch (error: any) {
            toast.error(error.message, { id: toastId })
        } finally {
            setIsSending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="lg:w-[50vw] w-[90vw] p-0 overflow-hidden border-border">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Mail className="h-5 w-5 text-blue-600" />
                        Notify Employees
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Selective payroll notification for <span className="font-semibold text-foreground">{periodName}</span>
                    </p>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="select-all"
                                checked={selectedIds.length === records.length && records.length > 0}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <label htmlFor="select-all" className="text-sm font-semibold text-foreground cursor-pointer">
                                Select All ({records.length})
                            </label>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                            {selectedIds.length} selected
                        </span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {records.map((record) => (
                            <div
                                key={record.id}
                                className={`flex items-center justify-between p-3 rounded-md border transition-colors cursor-pointer ${selectedIds.includes(record.id)
                                    ? "bg-primary/10 border-primary/20"
                                    : "hover:bg-muted/30 border-transparent"
                                    }`}
                                onClick={() => toggleRecord(record.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(record.id)}
                                        onChange={() => { }} // Handled by div onClick
                                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{record.employee_name}</p>
                                        <p className="text-xs text-muted-foreground font-mono">
                                            ₱{(record.total_net || record.net_pay || 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${record.status.toLowerCase().includes('released') ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'
                                    }`}>
                                    {record.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="p-6 pt-0 flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isSending}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={selectedIds.length === 0 || isSending}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
                    >
                        {isSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Mail className="h-4 w-4" />
                        )}
                        Send {selectedIds.length} Emails
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
