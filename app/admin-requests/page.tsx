"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, FileText, CheckCircle, XCircle, Search, AlertCircle } from "lucide-react"

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
  employee?: {
    full_name: string
    employee_code: string
    department: string
    position: string
  }
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [adminRemarks, setAdminRemarks] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("employee_requests")
      .select(`
        *,
        employee:employees(
          full_name,
          employee_code,
          department,
          position
        )
      `)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setRequests(data as Request[])
      setFilteredRequests(data as Request[])
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  useEffect(() => {
    let filtered = requests

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(r => r.status.toLowerCase() === statusFilter.toLowerCase())
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.employee?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employee?.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.request_type.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredRequests(filtered)
  }, [requests, searchTerm, statusFilter])

  const handleViewRequest = (request: Request) => {
    setSelectedRequest(request)
    setAdminRemarks(request.admin_remarks || "")
    setIsDialogOpen(true)
  }

  const handleUpdateStatus = async (status: "Approved" | "Rejected") => {
    if (!selectedRequest) return

    setIsProcessing(true)

    const { error } = await supabase
      .from("employee_requests")
      .update({
        status,
        admin_remarks: adminRemarks || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedRequest.id)

    if (!error) {
      await fetchRequests()
      setIsDialogOpen(false)
      setSelectedRequest(null)
      setAdminRemarks("")
    }

    setIsProcessing(false)
  }

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === "Pending").length,
    approved: requests.filter(r => r.status === "Approved").length,
    rejected: requests.filter(r => r.status === "Rejected").length,
  }

  return (
    <div className="space-y-8 p-6 min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Employee Requests</h1>
        <p className="text-slate-600">Review and manage overtime and holiday work requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Total Requests</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Pending</p>
              <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Approved</p>
              <p className="text-2xl font-bold text-slate-900">{stats.approved}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Rejected</p>
              <p className="text-2xl font-bold text-slate-900">{stats.rejected}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search by employee name, code, or request type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Status Filter */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="space-y-4">
        <TabsList className="bg-white border-0 shadow-sm">
          <TabsTrigger value="all">All Requests</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-3">
          {filteredRequests.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12">
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <FileText className="h-12 w-12 text-slate-300" />
                  <h3 className="text-lg font-medium text-slate-900">No requests found</h3>
                  <p className="text-slate-500 max-w-sm">
                    {searchTerm || statusFilter !== "all" 
                      ? "Try adjusting your filters to see more results."
                      : "No employee requests have been submitted yet."}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredRequests.map((request) => (
              <Card key={request.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="text-lg font-medium text-slate-900">
                          {request.employee?.full_name || "Unknown Employee"}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {request.employee?.employee_code} · {request.employee?.department} · {request.employee?.position}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={statusVariants[request.status] || statusVariants["Pending"]}
                      >
                        {request.status}
                      </Badge>
                    </div>

                    {/* Request Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Request Type</p>
                        <p className="text-sm text-slate-900 mt-1">{request.request_type}</p>
                      </div>
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
                      <div>
                        <p className="text-sm font-medium text-slate-600">Submitted</p>
                        <p className="text-sm text-slate-900 mt-1">
                          {formatDate(request.created_at)}
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

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => handleViewRequest(request)}
                      >
                        View Details
                      </Button>
                      {request.status === "Pending" && (
                        <>
                          <Button
                            variant="outline"
                            className="text-red-600 hover:text-red-700 border-slate-300"
                            onClick={() => {
                              setSelectedRequest(request)
                              setAdminRemarks(request.admin_remarks || "")
                              setIsDialogOpen(true)
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                          <Button
                            className="bg-slate-900 hover:bg-slate-800 text-white"
                            onClick={() => {
                              setSelectedRequest(request)
                              setAdminRemarks(request.admin_remarks || "")
                              setIsDialogOpen(true)
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Request Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl lg:w-[40vw]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-slate-900">
              Request Details
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Review and process this employee request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6 py-4">
              {/* Employee Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-slate-900">
                      {selectedRequest.employee?.full_name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {selectedRequest.employee?.employee_code} · {selectedRequest.employee?.department}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={statusVariants[selectedRequest.status] || statusVariants["Pending"]}
                  >
                    {selectedRequest.status}
                  </Badge>
                </div>
              </div>

              {/* Request Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-600">Request Type</p>
                  <p className="text-sm text-slate-900 mt-1">{selectedRequest.request_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Date</p>
                  <p className="text-sm text-slate-900 mt-1">
                    {formatDate(selectedRequest.date)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Start Time</p>
                  <p className="text-sm text-slate-900 mt-1">{selectedRequest.time_start}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">End Time</p>
                  <p className="text-sm text-slate-900 mt-1">{selectedRequest.time_end}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-slate-600">Submitted On</p>
                  <p className="text-sm text-slate-900 mt-1">
                    {formatDateTime(selectedRequest.created_at)}
                  </p>
                </div>
              </div>

              {/* Reason */}
              <div>
                <Label className="text-sm font-medium text-slate-900">Reason</Label>
                <p className="text-sm text-slate-900 mt-2 p-3 bg-slate-50 rounded-lg">
                  {selectedRequest.reason}
                </p>
              </div>

              {/* Admin Remarks */}
              <div className="space-y-2">
                <Label htmlFor="admin-remarks" className="text-sm font-medium text-slate-900">
                  Admin Remarks {selectedRequest.status === "Pending" && "(Optional)"}
                </Label>
                <Textarea
                  id="admin-remarks"
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  placeholder="Add any remarks or notes about this request..."
                  rows={3}
                  disabled={selectedRequest.status !== "Pending"}
                />
              </div>

              {selectedRequest.status !== "Pending" && (
                <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-slate-500 mt-0.5" />
                  <p className="text-sm text-slate-600">
                    This request has already been {selectedRequest.status.toLowerCase()}. 
                    You cannot change the status of processed requests.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedRequest?.status === "Pending" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleUpdateStatus("Rejected")}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-slate-400 rounded-full animate-pulse"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Request
                    </>
                  )}
                </Button>
                <Button
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                  onClick={() => handleUpdateStatus("Approved")}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Request
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsDialogOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}