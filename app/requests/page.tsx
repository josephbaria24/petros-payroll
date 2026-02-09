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
  "Approved": "bg-slate-900 text-white border-slate-200",
  "Pending": "bg-white text-slate-900 border-slate-300",
  "Rejected": "bg-slate-100 text-slate-600 border-slate-200",
  "Cancelled": "bg-slate-100 text-slate-600 border-slate-200",
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

    // Get employee record using email
    const { data: employeeData, error: empErr } = await supabase
      .from("employees")
      .select("id")
      .eq("email", user.email)
      .single()

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
    const { data: employeeData, error: empErr } = await supabase
      .from("employees")
      .select("id")
      .eq("email", user.email)
      .single()

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
    <div className="space-y-8 p-6 min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Employee Requests</h1>
        <p className="text-slate-600">Submit overtime and holiday work requests for approval</p>
      </div>

      {/* Submit Request Form */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-2">
            <Send className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-900">Submit New Request</h2>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-6">
            {/* Request Type */}
            <div className="space-y-2">
              <Label htmlFor="request-type" className="text-sm font-medium text-slate-900">
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
              <Label htmlFor="date" className="text-sm font-medium text-slate-900">
                Date
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
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
                <Label htmlFor="start-time" className="text-sm font-medium text-slate-900">
                  Start Time
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
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
                <Label htmlFor="end-time" className="text-sm font-medium text-slate-900">
                  End Time
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
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
              <Label htmlFor="reason" className="text-sm font-medium text-slate-900">
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
                className="bg-slate-900 hover:bg-slate-800 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
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
          <FileText className="h-5 w-5 text-slate-600" />
          <h2 className="text-xl font-semibold text-slate-900">Request History</h2>
        </div>

        {requests.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center text-center space-y-3">
                <FileText className="h-12 w-12 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-900">No requests yet</h3>
                <p className="text-slate-500 max-w-sm">
                  You haven't submitted any requests. Use the form above to submit your first request.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <Card key={request.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="text-lg font-medium text-slate-900">
                          {request.request_type}
                        </h3>
                        <p className="text-sm text-slate-500">
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
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Date</p>
                        <p className="text-sm text-slate-900 mt-1">
                          {formatDate(request.date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">Time</p>
                        <p className="text-sm text-slate-900 mt-1">
                          {request.time_start} - {request.time_end}
                        </p>
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <p className="text-sm font-medium text-slate-600">Reason</p>
                      <p className="text-sm text-slate-900 mt-1">{request.reason}</p>
                    </div>

                    {/* Admin Remarks */}
                    {request.admin_remarks && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-sm font-medium text-slate-600">Admin Remarks</p>
                        <p className="text-sm text-slate-600 mt-1 italic">{request.admin_remarks}</p>
                      </div>
                    )}

                    {/* Follow-up Note */}
                    {request.follow_up_note && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-sm font-medium text-slate-600">Your Follow-up Note</p>
                        <p className="text-sm text-slate-900 mt-1">{request.follow_up_note}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {request.status === "Pending" && (
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
                          className="text-red-600 hover:text-red-700"
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
            <DialogTitle className="text-xl font-semibold text-slate-900">
              Cancel Request
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Are you sure you want to cancel this request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-3 py-4">
              <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">Request Type</span>
                  <span className="text-sm text-slate-900">{selectedRequest.request_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">Date</span>
                  <span className="text-sm text-slate-900">{formatDate(selectedRequest.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">Time</span>
                  <span className="text-sm text-slate-900">
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
              className="text-red-600 hover:text-red-700 border-red-200"
              onClick={confirmCancel}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-slate-400 rounded-full animate-pulse"></div>
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
            <DialogTitle className="text-xl font-semibold text-slate-900">
              Add Follow-up Note
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Add additional information or context to your pending request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">Request Type</span>
                  <span className="text-sm text-slate-900">{selectedRequest.request_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-slate-600">Date</span>
                  <span className="text-sm text-slate-900">{formatDate(selectedRequest.date)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="follow-up-note" className="text-sm font-medium text-slate-900">
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
              className="bg-slate-900 hover:bg-slate-800 text-white"
              onClick={submitFollowUp}
              disabled={isProcessing || !followUpNote.trim()}
            >
              {isProcessing ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
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