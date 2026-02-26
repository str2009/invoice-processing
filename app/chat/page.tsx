"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Plus,
  Search,
  MessageCircle,
  FolderOpen,
  LayoutGrid,
  ArrowUp,
  Code2,
  Lightbulb,
  TrendingUp,
  PenLine,
  FileSpreadsheet,
  ChevronDown,
  User,
} from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const recentChats = [
  "Invoice enrichment analysis",
  "Part code lookup strategy",
  "Supplier margin review",
]

const quickActions = [
  { label: "Analyze", icon: Code2 },
  { label: "Learn", icon: Lightbulb },
  { label: "Strategize", icon: TrendingUp },
  { label: "Write", icon: PenLine },
  { label: "Invoices", icon: FileSpreadsheet },
]

  function useGreeting(): string {
  const [greeting, setGreeting] = useState("Hello")
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good morning")
    else if (hour < 18) setGreeting("Good afternoon")
    else setGreeting("Good evening")
  }, [])
  return greeting
  }

export default function ChatPage() {
  const router = useRouter()
  const greeting = useGreeting()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isConversation, setIsConversation] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 160) + "px"
    }
  }, [input])

  const handleSend = () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsConversation(true)

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "This is a placeholder response. Connect an AI backend to enable real conversations about your invoice data.",
      }
      setMessages((prev) => [...prev, assistantMessage])
    }, 800)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setInput("")
    setIsConversation(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        {/* Back to Invoice */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoice
          </button>
        </div>

        {/* Sidebar top nav */}
        <div className="flex flex-col gap-1 px-3 pt-1 pb-2">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
          <button className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>

        {/* Sidebar sections */}
        <div className="flex flex-col gap-1 px-3 py-2">
          <button className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <MessageCircle className="h-4 w-4" />
            Chats
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <FolderOpen className="h-4 w-4" />
            Invoices
          </button>
          <button
            onClick={() => router.push("/analytics")}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LayoutGrid className="h-4 w-4" />
            Analytics
          </button>
        </div>

        {/* Recents */}
        <div className="flex flex-col px-3 py-3">
          <span className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Recents
          </span>
          <div className="flex flex-col gap-0.5">
            {recentChats.map((chat) => (
              <button
                key={chat}
                className="truncate rounded-lg px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {chat}
              </button>
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User profile */}
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <User className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                User
              </span>
              <span className="text-[11px] text-muted-foreground">
                Pro plan
              </span>
            </div>
            <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {!isConversation ? (
          /* Welcome state */
          <div className="flex flex-1 flex-col items-center justify-center px-4">
            <div className="flex w-full max-w-xl flex-col items-center">
              {/* Greeting */}
              <h1 className="mb-8 text-center font-sans text-4xl font-light tracking-tight text-foreground">
                <span className="mr-2 inline-block text-primary">*</span>
                {greeting}
              </h1>

              {/* Input box */}
              <div className="w-full rounded-2xl border border-border bg-card p-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="How can I help you today?"
                  rows={1}
                  className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Attach file"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      GPT-4o
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
                      aria-label="Send message"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {quickActions.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => {
                      setInput(`Help me ${label.toLowerCase()} `)
                      textareaRef.current?.focus()
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Conversation state */
          <>
            {/* Header bar */}
            <header className="flex shrink-0 items-center justify-center border-b border-border px-4 py-2">
              <span className="text-sm font-medium text-foreground">
                AI Assistant
              </span>
            </header>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        message.role === "assistant"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {message.role === "assistant" ? "*" : "U"}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "bg-secondary text-secondary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Input bar */}
            <div className="shrink-0 border-t border-border px-4 py-3">
              <div className="mx-auto max-w-2xl">
                <div className="rounded-2xl border border-border bg-card p-1">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your invoices..."
                    rows={1}
                    className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                  <div className="flex items-center justify-between px-3 pb-2">
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label="Attach file"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                        GPT-4o
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
                        aria-label="Send message"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
