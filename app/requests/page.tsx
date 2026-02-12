"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, Clock, FileText, Send, XCircle, MessageSquare } from "lucide-react"
// Date formatting helper
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}



const statusVariants: Record<string, string> = {
  "Approved": "bg-primary text-primary-foreground border-transparent",
  "Pending": "bg-muted text-muted-foreground border-border",
  "Rejected": "bg-muted/50 text-muted-foreground border-border",
  "Cancelled": "bg-muted/50 text-muted-foreground border-border",
}

interface Request {
  id: string
  employee_id: string
  request_type: string
  date: string
  time_start: string
  time_end: string
  reason: string
  status: string
  admin_remarks: string | null
  created_at: string
  follow_up_note?: string | null
}

export default function MyRequestsPage() {
  const { activeOrganization } = useOrganization()
  const [type, setType] = useState("Overtime")
  const [date, setDate] = useState("")
  const [timeStart, setTimeStart] = useState("")
  const [timeEnd, setTimeEnd] = useState("")
  const [reason, setReason] = useState("")
  const [requests, setRequests] = useState<Request[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dialog states
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isFollowUpDialogOpen, setIsFollowUpDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [followUpNote, setFollowUpNote] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchRequests = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("User is not authenticated.")
      return
    }

    if (activeOrganization === "palawan") {
      // Fetch Palawan employee from localStorage
      const storedEmployees = localStorage.getItem("palawan_employees")
      const palawanEmployees = storedEmployees ? JSON.parse(storedEmployees) : []

      const employee = palawanEmployees.find((emp: any) => emp.email === user.email)

      if (!employee) {
        console.error("Employee record not found for Palawan user:", user.email)
        return
      }

      // Fetch requests from localStorage
      const storedRequests = localStorage.getItem("palawan_requests")
      const palawanRequests = storedRequests ? JSON.parse(storedRequests) : []

      const employeeRequests = palawanRequests
        .filter((req: any) => req.employee_id === employee.id)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setRequests(employeeRequests)
      return
    }

    if (!user.email) {
      console.error("User email not found in session")
      return
    }

    // Get employee record using email
    const { data: employeeData, error: empErr } = await supabase
      .from("employees")
      .select("id")
      .ilike("email", user.email)
      .maybeSingle()

    if (empErr || !employeeData) {
      console.error("Employee record not found for user:", user.email)
      return
    }

    const { data, error } = await supabase
      .from("employee_requests")
      .select("*")
      .eq("employee_id", employeeData.id)
      .order("created_at", { ascending: false })

    if (!error) setRequests(data || [])
  }

  const handleCancelRequest = (request: Request) => {
    setSelectedRequest(request)
    setIsCancelDialogOpen(true)
  }

  const confirmCancel = async () => {
    if (!selectedRequest) return

    setIsProcessing(true)

    const { error } = await supabase
      .from("employee_requests")
      .update({
        status: "Cancelled",
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedRequest.id)

    if (!error) {
      await fetchRequests()
      setIsCancelDialogOpen(false)
      setSelectedRequest(null)
    }

    setIsProcessing(false)
  }

  const handleFollowUp = (request: Request) => {
    setSelectedRequest(request)
    setFollowUpNote(request.follow_up_note || "")
    setIsFollowUpDialogOpen(true)
  }

  const submitFollowUp = async () => {
    if (!selectedRequest || !followUpNote.trim()) return

    setIsProcessing(true)

    const { error } = await supabase
      .from("employee_requests")
      .update({
        follow_up_note: followUpNote,
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedRequest.id)

    if (!error) {
      await fetchRequests()
      setIsFollowUpDialogOpen(false)
      setSelectedRequest(null)
      setFollowUpNote("")
    }

    setIsProcessing(false)
  }

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      setIsSubmitting(false)
      return
    }

    if (activeOrganization === "palawan") {
      // Get Palawan employee from localStorage
      const storedEmployees = localStorage.getItem("palawan_employees")
      const palawanEmployees = storedEmployees ? JSON.parse(storedEmployees) : []

      const employee = palawanEmployees.find((emp: any) => emp.email === user.email)

      if (!employee) {
        console.error("Employee record not found for Palawan user:", user.email)
        setIsSubmitting(false)
        return
      }

      // Create new request for localStorage
      const newRequest = {
        id: `palawan_req_${Date.now()}`,
        employee_id: employee.id,
        request_type: type,
        date,
        time_start: timeStart,
        time_end: timeEnd,
        reason,
        status: "Pending",
        admin_remarks: null,
        created_at: new Date().toISOString(),
        follow_up_note: null
      }

      // Save to localStorage
      const storedRequests = localStorage.getItem("palawan_requests")
      const palawanRequests = storedRequests ? JSON.parse(storedRequests) : []
      palawanRequests.push(newRequest)
      localStorage.setItem("palawan_requests", JSON.stringify(palawanRequests))

      // Reset form
      setType("Overtime")
      setDate("")
      setTimeStart("")
      setTimeEnd("")
      setReason("")

      // Refresh requests list
      fetchRequests()
      setIsSubmitting(false)
      return
    }

    // Get employee record using email
    if (!user.email) {
      console.error("User email not found in session")
      setIsSubmitting(false)
      return
    }

    console.log("[Requests] Fetching employee for:", user.email)

    const { data: employeeData, error: empErr } = await supabase
      .from("employees")
      .select("id")
      .ilike("email", user.email)
      .maybeSingle()

    if (empErr || !employeeData) {
      console.error("Employee record not found for user:", user.email)
      setIsSubmitting(false)
      return
    }

    const { error } = await supabase.from("employee_requests").insert([
      {
        employee_id: employeeData.id,
        request_type: type,
        date,
        time_start: timeStart,
        time_end: timeEnd,
        reason,
        status: "Pending",
      }
    ])

    if (!error) {
      // Reset form
      setType("Overtime")
      setDate("")
      setTimeStart("")
      setTimeEnd("")
      setReason("")

      // Refresh requests list
      fetchRequests()
    }

    setIsSubmitting(false)
  }

  useEffect(() => {
    fetchRequests()
  }, [activeOrganization])

  return (
    <div className="space-y-8 p-6 min-h-screen bg-background text-foreground">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Employee Requests</h1>
        <p className="text-muted-foreground">Submit overtime and holiday work requests for approval</p>
      </div>

      {/* Submit Request Form */}
      <Card className="border border-border shadow-sm bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-2">
            <Send className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Submit New Request</h2>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-6">
            {/* Request Type */}
            <div className="space-y-2">
              <Label htmlFor="request-type" className="text-sm font-medium text-foreground">
                Request Type
              </Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="request-type">
                  <SelectValue placeholder="Select request type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Overtime">Overtime</SelectItem>
                  <SelectItem value="Holiday Work">Holiday Work</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-medium text-foreground">
                Date
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time" className="text-sm font-medium text-foreground">
                  Start Time
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="start-time"
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time" className="text-sm font-medium text-foreground">
                  End Time
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="end-time"
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium text-foreground">
                Reason
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder="Provide a detailed reason for your request..."
                rows={4}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-primary-foreground rounded-full animate-pulse"></div>
                    <span>Submitting...</span>
                  </div>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Request
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous Requests */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Request History</h2>
        </div>

        {requests.length === 0 ? (
          <Card className="border border-border shadow-sm bg-card">
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center text-center space-y-3">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium text-foreground">No requests yet</h3>
                <p className="text-muted-foreground max-w-sm">
                  You haven't submitted any requests. Use the form above to submit your first request.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <Card key={request.id} className="border border-border shadow-sm hover:shadow-md transition-shadow bg-card">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="text-lg font-medium text-foreground">
                          {request.request_type}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Submitted on {formatDateTime(request.created_at)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={statusVariants[request.status] || statusVariants["Pending"]}
                      >
                        {request.status}
                      </Badge>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Date</p>
                        <p className="text-sm text-foreground mt-1">
                          {formatDate(request.date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Time</p>
                        <p className="text-sm text-foreground mt-1">
                          {request.time_start} - {request.time_end}
                        </p>
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Reason</p>
                      <p className="text-sm text-foreground mt-1">{request.reason}</p>
                    </div>

                    {/* Admin Remarks */}
                    {request.admin_remarks && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-sm font-medium text-muted-foreground">Admin Remarks</p>
                        <p className="text-sm text-muted-foreground mt-1 italic">{request.admin_remarks}</p>
                      </div>
                    )}

                    {/* Follow-up Note */}
                    {request.follow_up_note && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-sm font-medium text-muted-foreground">Your Follow-up Note</p>
                        <p className="text-sm text-foreground mt-1">{request.follow_up_note}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {request.status === "Pending" && (
                      <div className="flex justify-end gap-2 pt-2 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFollowUp(request)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Add Follow-up
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-600 border-red-200"
                          onClick={() => handleCancelRequest(request)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel Request
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Request Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="sm:max-w-md lg:w-[35vw]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">
              Cancel Request
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to cancel this request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-3 py-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2 border border-border">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Request Type</span>
                  <span className="text-sm text-foreground">{selectedRequest.request_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Date</span>
                  <span className="text-sm text-foreground">{formatDate(selectedRequest.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Time</span>
                  <span className="text-sm text-foreground">
                    {selectedRequest.time_start} - {selectedRequest.time_end}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCancelDialogOpen(false)}
              disabled={isProcessing}
            >
              Keep Request
            </Button>
            <Button
              variant="outline"
              className="text-red-500 hover:text-red-600 border-red-100"
              onClick={confirmCancel}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-muted/30 rounded-full animate-pulse"></div>
                  <span>Cancelling...</span>
                </div>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-up Dialog */}
      <Dialog open={isFollowUpDialogOpen} onOpenChange={setIsFollowUpDialogOpen}>
        <DialogContent className="sm:max-w-md lg:w-[35vw]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">
              Add Follow-up Note
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add additional information or context to your pending request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2 border border-border">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Request Type</span>
                  <span className="text-sm text-foreground">{selectedRequest.request_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Date</span>
                  <span className="text-sm text-foreground">{formatDate(selectedRequest.date)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="follow-up-note" className="text-sm font-medium text-foreground">
                  Follow-up Note
                </Label>
                <Textarea
                  id="follow-up-note"
                  value={followUpNote}
                  onChange={(e) => setFollowUpNote(e.target.value)}
                  placeholder="Add any additional information or clarifications..."
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsFollowUpDialogOpen(false)
                setFollowUpNote("")
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={submitFollowUp}
              disabled={isProcessing || !followUpNote.trim()}
            >
              {isProcessing ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-primary-foreground rounded-full animate-pulse"></div>
                  <span>Saving...</span>
                </div>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Follow-up
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}