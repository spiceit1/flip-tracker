export type Priority = "high" | "medium" | "low";
export type TaskStatus = "backlog" | "in-progress" | "in-review" | "done";
export type Assignee = "douglas" | "shmack";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee: Assignee;
  priority: Priority;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: "task_completed" | "task_created" | "task_moved" | "agent_action";
  message: string;
  taskId?: string;
  taskTitle?: string;
  timestamp: string;
  actor: "douglas" | "shmack";
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "planning" | "completed" | "in-progress" | "paused" | "done";
  priority: "high" | "medium" | "low";
  assignee: string;
  tasks?: { total: number; completed: number };
  createdAt: string;
  // Legacy fields (optional)
  url?: string;
  type?: "google-sheets" | "google-slides" | "web-app" | "github" | "other";
  lastUpdated?: string;
}

export interface CronSchedule {
  kind: string;
  expr?: string;
  tz?: string;
  staggerMs?: number;
}

export interface CronJob {
  id?: string;
  name: string;
  schedule: string | CronSchedule;
  description?: string;
  enabled?: boolean;
  lastRun?: string | null;
  nextRun?: string | null;
  lastStatus?: "success" | "failed" | "running" | null;
  command?: string;
  model?: string;
  channel?: string;
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: string;
    lastStatus?: string;
    lastDurationMs?: number;
    consecutiveErrors?: number;
  };
  payload?: {
    kind?: string;
    message?: string;
  };
  delivery?: {
    channel?: string;
    to?: string;
  };
}
