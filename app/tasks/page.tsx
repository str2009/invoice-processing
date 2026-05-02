"use client"

import { useState, useCallback } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Task type
interface Task {
  id: string
  title: string
  status: "todo" | "in_progress" | "done"
  assigned_to: string
}

// Initial mock data
const initialTasks: Task[] = [
  { id: "1", title: "Review invoice #1234", status: "todo", assigned_to: "Ivan" },
  { id: "2", title: "Update parts catalog", status: "in_progress", assigned_to: "Maria" },
  { id: "3", title: "Contact supplier ABC", status: "done", assigned_to: "Alex" },
  { id: "4", title: "Check inventory levels", status: "todo", assigned_to: "Ivan" },
]

// Status badge variants
const statusConfig: Record<Task["status"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  todo: { label: "To Do", variant: "outline" },
  in_progress: { label: "In Progress", variant: "secondary" },
  done: { label: "Done", variant: "default" },
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskAssignee, setNewTaskAssignee] = useState("")

  // Add new task
  const handleAddTask = useCallback(() => {
    if (!newTaskTitle.trim()) return

    const newTask: Task = {
      id: String(Date.now()),
      title: newTaskTitle.trim(),
      status: "todo",
      assigned_to: newTaskAssignee.trim() || "Unassigned",
    }

    setTasks((prev) => [...prev, newTask])
    setNewTaskTitle("")
    setNewTaskAssignee("")
    setIsModalOpen(false)
  }, [newTaskTitle, newTaskAssignee])

  // Handle Enter key in modal
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && newTaskTitle.trim()) {
        handleAddTask()
      }
    },
    [handleAddTask, newTaskTitle]
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2">
        <h1 className="text-sm font-semibold">Tasks</h1>
        <Button
          size="sm"
          className="h-7 gap-1.5 px-3 text-xs"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          New Task
        </Button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="h-9 text-xs font-medium">Title</TableHead>
                <TableHead className="h-9 w-32 text-xs font-medium">Status</TableHead>
                <TableHead className="h-9 w-40 text-xs font-medium">Assigned To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <TableRow key={task.id} className="h-10">
                    <TableCell className="text-sm">{task.title}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[task.status].variant} className="text-[10px]">
                        {statusConfig[task.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task.assigned_to}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-sm text-muted-foreground">
                    No tasks yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* New Task Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-sm">New Task</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-xs">
                Title
              </Label>
              <Input
                id="title"
                placeholder="Enter task title..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignee" className="text-xs">
                Assigned To
              </Label>
              <Input
                id="assignee"
                placeholder="Enter assignee name..."
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleAddTask}
              disabled={!newTaskTitle.trim()}
            >
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
