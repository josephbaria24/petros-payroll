"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useProtectedPage } from "../hooks/useProtectedPage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"
import { Users, Shield, ShieldCheck, Mail, UserCog, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type Profile = {
  id: string
  email: string
  role: string
  fullname: string | null
  avatar_url: string | null
  permissions: Record<string, boolean>
}

const ADMIN_PAGES = [
  { id: "dashboard", label: "Dashboard", description: "Access to main analytics overview" },
  { id: "reports", label: "Reports", description: "Access to summary and export reports" },
  { id: "employees", label: "Employees", description: "Manage employee records and profiles" },
  { id: "timekeeping", label: "Timekeeping", description: "Administer attendance logs and statuses" },
  { id: "admin-requests", label: "Requests", description: "Approve or reject employee requests" },
  { id: "payroll", label: "Payroll", description: "Process and view payroll records" },
  { id: "deductions", label: "Deductions", description: "Manage employee deduction settings" },
  { id: "user-manager", label: "User Manager", description: "Manage other users and their permissions" },
]

export default function UserManagerPage() {
  useProtectedPage(["hr", "admin"], "user-manager")
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const fetchProfiles = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("fullname", { ascending: true })

    if (error) {
      toast.error("Error fetching profiles")
    } else {
      setProfiles(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchProfiles()
  }, [])

  const handleEditPermissions = (profile: Profile) => {
    setSelectedProfile(profile)
    setEditPermissions(profile.permissions || {})
  }

  const handleSavePermissions = async () => {
    if (!selectedProfile) return
    setSaving(true)

    const { error } = await supabase
      .from("profiles")
      .update({ permissions: editPermissions })
      .eq("id", selectedProfile.id)

    if (error) {
      toast.error("Error updating permissions")
    } else {
      toast.success("Permissions updated successfully")
      fetchProfiles()
      setSelectedProfile(null)
    }
    setSaving(false)
  }

  const filteredProfiles = profiles.filter(p => 
    p.fullname?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const togglePermission = (id: string, checked: boolean) => {
    setEditPermissions(prev => ({ ...prev, [id]: checked }))
  }

  return (
    <div className="space-y-8 p-6 min-h-screen bg-background text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">User Manager</h1>
          <p className="text-muted-foreground text-sm">
            Control granular access permissions for HR and Administrative staff
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card className="border border-border shadow-sm bg-card transition-all">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search users..." 
                  className="pl-9 h-9 text-xs font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                 <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-bold">
                    {profiles.length} Total Users
                 </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3">User</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3 text-center">Role</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3">Access Level</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell colSpan={4} className="h-16 bg-muted/5" />
                    </TableRow>
                  ))
                ) : filteredProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                        <Users className="h-12 w-12 opacity-10" />
                        <p className="text-sm font-medium">No users found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProfiles.map((profile) => {
                    const activePermissionsCount = Object.values(profile.permissions || {}).filter(Boolean).length;
                    
                    return (
                      <TableRow key={profile.id} className="group border-border/50 hover:bg-muted/20 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                              {profile.fullname?.[0] || profile.email[0].toUpperCase()}
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-sm font-bold text-foreground">{profile.fullname || "Anonymous"}</p>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {profile.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5",
                              profile.role === "admin" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                              profile.role === "hr" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                              profile.role === "employee" && "bg-slate-500/10 text-slate-500 border-slate-500/20"
                            )}
                          >
                            {profile.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                             <span className="text-xs font-semibold text-muted-foreground mr-1">
                                {activePermissionsCount} of {ADMIN_PAGES.length} pages
                             </span>
                             {activePermissionsCount === ADMIN_PAGES.length ? (
                               <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-black uppercase tracking-tighter">Full Access</Badge>
                             ) : activePermissionsCount === 0 ? (
                               <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[9px] font-black uppercase tracking-tighter">No Access</Badge>
                             ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 gap-2 font-bold text-xs hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleEditPermissions(profile)}
                            disabled={profile.role === "employee"}
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Manage Access
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Permissions Dialog */}
      <Dialog open={!!selectedProfile} onOpenChange={(o) => (!o && setSelectedProfile(null))}>
        <DialogContent className="lg:w-[35vw] w-[90vw] p-0 overflow-hidden rounded-2xl border-border bg-card">
          <DialogHeader className="p-6 pb-4 bg-muted/30 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                <UserCog className="h-6 w-6" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-bold">Permissions Manager</DialogTitle>
                <p className="text-sm text-muted-foreground">Managing access for <b>{selectedProfile?.fullname || selectedProfile?.email}</b></p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
             <div className="space-y-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Administrative Privileges</p>
                <div className="grid grid-cols-1 gap-3">
                  {ADMIN_PAGES.map((page) => (
                    <div 
                      key={page.id} 
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer group hover:shadow-sm",
                        editPermissions[page.id] 
                          ? "bg-primary/5 border-primary/20" 
                          : "bg-background border-border hover:border-primary/10"
                      )}
                      onClick={() => togglePermission(page.id, !editPermissions[page.id])}
                    >
                      <div className="pt-0.5">
                        <Checkbox 
                          id={`perm-${page.id}`}
                          checked={!!editPermissions[page.id]}
                          onCheckedChange={(checked) => togglePermission(page.id, !!checked)}
                          className="rounded-md border-muted-foreground h-4 w-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </div>
                      <div className="space-y-1 select-none flex-1">
                        <Label 
                          htmlFor={`perm-${page.id}`} 
                          className="text-sm font-bold cursor-pointer group-hover:text-primary transition-colors"
                        >
                          {page.label}
                        </Label>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{page.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>

          <DialogFooter className="p-6 pt-2 bg-muted/30 border-t border-border gap-2">
            <Button variant="outline" className="font-bold text-xs h-10 px-6 rounded-xl" onClick={() => setSelectedProfile(null)}>Cancel</Button>
            <Button 
              className="font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-primary/20" 
              onClick={handleSavePermissions}
              disabled={saving}
            >
              {saving ? "Saving Changes..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ")
}
